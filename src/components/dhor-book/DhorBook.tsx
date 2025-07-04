import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client.ts";
import { Card } from "@/components/ui/card.tsx";
import { addWeeks, endOfWeek, format, startOfWeek, subWeeks } from "date-fns";
import { Calendar, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { DhorBookGrid } from "./DhorBookGrid.tsx";
import { DailyActivityEntry } from "@/types/dhor-book.ts";

interface DhorBookProps {
  studentId: string;
  teacherId?: string;
  teacherData?: { madrassah_id: string; section: string } | null;
  isAdmin: boolean;
  isLoadingTeacher: boolean;
}

export const DhorBook = ({
  studentId,
  teacherId,
  teacherData,
  isAdmin,
  isLoadingTeacher,
}: DhorBookProps) => {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [entries, setEntries] = useState<DailyActivityEntry[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Format dates for display
  const weekStart = startOfWeek(currentWeek);
  const weekEnd = endOfWeek(currentWeek);
  const formattedDateRange = `${format(weekStart, "MMM d")} - ${
    format(weekEnd, "MMM d, yyyy")
  }`;

  const {
    data: students,
    isLoading: studentsLoading,
    error: studentsError,
  } = useQuery({
    queryKey: ["dhorbook-student-auth", studentId, isAdmin, teacherData],
    queryFn: async () => {
      // For teachers, if teacherData is not ready, don't fetch.
      if (!isAdmin && !teacherData) {
        return [];
      }

      let query = supabase
        .from("students")
        .select("id")
        .eq("id", studentId)
        .limit(1);

      // If not an admin, must be a teacher. Apply teacher filters for authorization.
      if (!isAdmin) {
        if (teacherData?.madrassah_id && teacherData?.section) {
          query = query
            .eq("madrassah_id", teacherData.madrassah_id)
            .eq("section", teacherData.section);
        } else {
          // Teacher has no section/madrassah, so they are not authorized to see any student.
          return [];
        }
      } else {
        // For Admins, check if student is in their madrassah
        if (teacherData?.madrassah_id) {
          query = query.eq("madrassah_id", teacherData.madrassah_id);
        } else {
          return [];
        }
      }
      // For Admins, query remains as a check for student existence by ID.

      const { data, error } = await query;
      if (error) {
        console.error("Error fetching student for authorization:", error);
        throw error;
      }
      return data || [];
    },
    enabled: !!studentId && (isAdmin || !!teacherData),
  });

  // Authorization is confirmed if user is admin OR if the studentId is in the fetched list
  const isAuthorized = isAdmin ||
    (students?.some((s) => s.id === studentId) ?? false);

  const showUnauthorized = !isAdmin && !studentsLoading && !isAuthorized;

  // Previous and next week handlers
  const goToPreviousWeek = () => setCurrentWeek((prev) => subWeeks(prev, 1));
  const goToNextWeek = () => setCurrentWeek((prev) => addWeeks(prev, 1));
  const goToCurrentWeek = () => setCurrentWeek(new Date());

  // Fetch main entries for the student
  const {
    data: entriesData,
    isLoading: entriesLoading,
    refetch,
  } = useQuery({
    queryKey: [
      "dhor-book-entries",
      studentId,
      format(weekStart, "yyyy-MM-dd"),
      format(weekEnd, "yyyy-MM-dd"),
    ],
    queryFn: async () => {
      console.log(
        `Fetching dhor book for student ${studentId} between ${
          format(weekStart, "yyyy-MM-dd")
        } and ${format(weekEnd, "yyyy-MM-dd")}`,
      );

      // Fetch all data sources (excluding dhor_book_entries)
      const { data: juzRevisions, error: juzError } = await supabase
        .from("juz_revisions")
        .select("*")
        .eq("student_id", studentId)
        .gte("revision_date", format(weekStart, "yyyy-MM-dd"))
        .lte("revision_date", format(weekEnd, "yyyy-MM-dd"));
      if (juzError) console.error("Error fetching juz revisions:", juzError);

      const { data: sabaqPara, error: sabaqError } = await supabase
        .from("sabaq_para")
        .select("*")
        .eq("student_id", studentId)
        .gte("revision_date", format(weekStart, "yyyy-MM-dd"))
        .lte("revision_date", format(weekEnd, "yyyy-MM-dd"));
      if (sabaqError) console.error("Error fetching sabaq para:", sabaqError);

      const { data: progressEntries, error: progressError } = await supabase
        .from("progress")
        .select("*")
        .eq("student_id", studentId)
        .gte("date", format(weekStart, "yyyy-MM-dd"))
        .lte("date", format(weekEnd, "yyyy-MM-dd"));
      if (progressError) {
        console.error("Error fetching progress:", progressError);
      }

      // --- Data Consolidation Logic ---
      const combinedEntriesMap: Record<string, Partial<DailyActivityEntry>> =
        {};

      const ensureEntry = (dateKey: string) => {
        if (!combinedEntriesMap[dateKey]) {
          combinedEntriesMap[dateKey] = {
            id: `generated-${dateKey}-${studentId}`, // Default ID
            student_id: studentId,
            entry_date: dateKey,
            teacher_id: teacherId || "system-unknown", // Ensure teacher_id is present
            juz_revisions_data: [], // Initialize as empty array
          };
        }
      };

      // 2. Merge progress data
      (progressEntries || []).forEach((pEntry) => {
        if (!pEntry.date) return;
        const dateKey = pEntry.date;
        ensureEntry(dateKey);
        const existingEntry = combinedEntriesMap[dateKey];
        combinedEntriesMap[dateKey] = {
          ...existingEntry,
          current_juz: pEntry.current_juz ?? existingEntry?.current_juz,
          current_surah: pEntry.current_surah ?? existingEntry?.current_surah,
          start_ayat: pEntry.start_ayat ?? existingEntry?.start_ayat,
          end_ayat: pEntry.end_ayat ?? existingEntry?.end_ayat,
          memorization_quality: pEntry.memorization_quality ||
            existingEntry?.memorization_quality,
          comments: (pEntry as { comments?: string }).comments ||
            existingEntry?.comments,
        };
      });

      // 3. Merge sabaq_para data
      (sabaqPara || []).forEach((spEntry) => {
        if (!spEntry.revision_date) return;
        const dateKey = spEntry.revision_date;
        ensureEntry(dateKey);
        const existingEntry = combinedEntriesMap[dateKey];
        combinedEntriesMap[dateKey] = {
          ...existingEntry,
          sabaq_para_data: spEntry,
          comments: existingEntry?.comments || spEntry.teacher_notes, // Prefer existing comments
        };
      });

      // 4. Merge juz_revisions data
      (juzRevisions || []).forEach((jrEntry) => {
        if (!jrEntry.revision_date) return;
        const dateKey = jrEntry.revision_date;
        ensureEntry(dateKey);
        const existingEntry = combinedEntriesMap[dateKey];
        const updatedRevisions = [
          ...(existingEntry?.juz_revisions_data || []),
          jrEntry,
        ].sort((a, b) => (a.dhor_slot || 0) - (b.dhor_slot || 0)); // Sort by dhor_slot

        // Deduplicate revisions based on id (PK of juz_revisions) if necessary, assuming new ones are appended
        // For simplicity, this example appends; a real-world scenario might need upsert logic for revisions.
        const uniqueRevisions = Array.from(
          new Map(updatedRevisions.map((r) => [r.id, r])).values(),
        );

        combinedEntriesMap[dateKey] = {
          ...existingEntry,
          juz_revisions_data: uniqueRevisions,
        };
      });

      // Convert map to array
      // Filter out days that have no actual data beyond the generated shell
      const finalCombinedEntries: DailyActivityEntry[] = Object.values(
        combinedEntriesMap,
      )
        .filter((entry) =>
          entry.current_juz !== undefined || // Check for actual progress data field
          entry.sabaq_para_data ||
          (entry.juz_revisions_data && entry.juz_revisions_data.length > 0)
        )
        .map((entry) => entry as DailyActivityEntry); // Cast to full type

      // Sort entries by date (newest first)
      finalCombinedEntries.sort((a, b) =>
        new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime()
      );

      console.log(
        `Consolidated ${finalCombinedEntries.length} dhor book entries for the week`,
      );
      return finalCombinedEntries;
    },
    enabled: !!studentId && isAuthorized,
  });

  // Update entries when data changes
  useEffect(() => {
    if (entriesData) {
      setEntries(entriesData);
    }
  }, [entriesData]);

  if (isLoadingTeacher) {
    return (
      <Card className="flex items-center justify-center p-6 h-full min-h-[200px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">
          Loading teacher data...
        </span>
      </Card>
    );
  }

  // Handle refresh request
  const handleRefresh = () => {
    setIsRefreshing(true);
    refetch().finally(() => {
      setTimeout(() => {
        setIsRefreshing(false);
      }, 500); // Brief delay to show refresh indicator
    });
  };

  if (!studentId) {
    return (
      <Card className="p-6 text-center">
        <p>Please select a student to view their Dhor Book.</p>
      </Card>
    );
  }

  // Show loading spinner while we're confirming the student list
  if (studentsLoading && !isAdmin) {
    return (
      <Card className="p-6">
        <div className="flex justify-center items-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
          <span>Verifying student access...</span>
        </div>
      </Card>
    );
  }

  if (studentsError) {
    return (
      <Card className="p-6 text-center text-red-500">
        <p>Error verifying student access: {studentsError.message}</p>
      </Card>
    );
  }

  // Show unauthorized message only after checks are complete
  if (showUnauthorized) {
    return (
      <Card className="p-6 text-center text-red-500">
        <p>You are not authorized to view this student's records.</p>
      </Card>
    );
  }

  // Don't render the grid if not authorized or still loading entries
  if (!isAuthorized || entriesLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        {entriesLoading && (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
            <span>Loading Dhor Book entries...</span>
          </>
        )}
      </div>
    );
  }

  return (
    <Card className="p-4 sm:p-6">
      {/* Week Navigation Controls */}
      <div className="flex items-center justify-between mb-6">
        <Button variant="outline" size="sm" onClick={goToPreviousWeek}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Previous
        </Button>

        <div className="flex items-center">
          <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
          <span className="font-medium text-sm sm:text-base">
            {formattedDateRange}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-2 h-8 px-2"
            onClick={goToCurrentWeek}
          >
            Today
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="ml-1 h-8 px-2"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : (
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            )}
          </Button>
        </div>

        <Button variant="outline" size="sm" onClick={goToNextWeek}>
          Next <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

      {/* DhorBookGrid component displays entries in a weekly grid */}
      <DhorBookGrid
        entries={entries}
        studentId={studentId}
        teacherId={teacherId ?? "system-unknown"} // Ensure teacherId is always a string
        currentWeek={currentWeek}
        onRefresh={handleRefresh}
      />
    </Card>
  );
};
