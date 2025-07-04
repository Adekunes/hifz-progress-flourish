import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client.ts";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { RefreshCcw, User, UserCheck, UserX } from "lucide-react";
import { StudentAssignment } from "@/types/user.ts";
import { useToast } from "@/hooks/use-toast.ts";

interface StudentStatusListProps {
  teacherId: string;
}

export const StudentStatusList = ({ teacherId }: StudentStatusListProps) => {
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const {
    data: studentAssignments,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["teacher-students", teacherId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students_teachers")
        .select(`
          id, 
          student_name, 
          teacher_id, 
          active, 
          assigned_date
        `)
        .eq("teacher_id", teacherId)
        .order("assigned_date", { ascending: false });

      if (error) {
        console.error("Error fetching student assignments:", error);
        throw error;
      }

      return data as StudentAssignment[];
    },
    enabled: !!teacherId,
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
      toast({
        title: "Refreshed",
        description: "Student list has been updated.",
      });
    } catch (error) {
      console.error("Error refreshing student list:", error);
      toast({
        title: "Refresh failed",
        description: "Could not refresh student list. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const activeStudents =
    studentAssignments?.filter((student) => student.active) || [];
  const inactiveStudents =
    studentAssignments?.filter((student) => !student.active) || [];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">My Students</h3>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center space-x-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-[250px]" />
                <Skeleton className="h-4 w-[200px]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">My Students</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCcw
            className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`}
          />
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {activeStudents.length === 0 && inactiveStudents.length === 0
        ? (
          <div className="text-center py-8 text-muted-foreground">
            <User className="h-12 w-12 mx-auto mb-2 opacity-20" />
            <p>No students assigned yet</p>
          </div>
        )
        : (
          <>
            {activeStudents.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <UserCheck className="h-5 w-5 text-green-500" />
                  <span className="font-medium">Active Students</span>
                  <Badge variant="outline">{activeStudents.length}</Badge>
                </div>
                <div className="grid gap-2">
                  {activeStudents.map((student) => (
                    <div
                      key={student.id}
                      className="p-3 border rounded-lg flex justify-between items-center"
                    >
                      <div>
                        <div className="font-medium">
                          {student.student_name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Assigned:{" "}
                          {new Date(student.assigned_date).toLocaleDateString()}
                        </div>
                      </div>
                      <Badge className="bg-green-500 hover:bg-green-600">
                        Active
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {inactiveStudents.length > 0 && (
              <div className="space-y-2 mt-4">
                <div className="flex items-center space-x-2">
                  <UserX className="h-5 w-5 text-red-500" />
                  <span className="font-medium">Inactive Students</span>
                  <Badge variant="outline">{inactiveStudents.length}</Badge>
                </div>
                <div className="grid gap-2">
                  {inactiveStudents.map((student) => (
                    <div
                      key={student.id}
                      className="p-3 border rounded-lg flex justify-between items-center bg-muted/30"
                    >
                      <div>
                        <div className="font-medium">
                          {student.student_name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Assigned:{" "}
                          {new Date(student.assigned_date).toLocaleDateString()}
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className="text-muted-foreground"
                      >
                        Inactive
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
    </div>
  );
};
