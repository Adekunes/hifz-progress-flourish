
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { BookOpen, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ProgressStats } from "@/components/progress/ProgressStats";
import { ProgressTable } from "@/components/progress/ProgressTable";
import type { Progress } from "@/types/progress";

const Progress = () => {
  const { data: progressData, isLoading } = useQuery({
    queryKey: ['progress'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('progress')
        .select(`
          *,
          students(name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Progress[];
    },
  });

  const calculateOverallProgress = () => {
    if (!progressData?.length) return 0;
    const totalStudents = progressData.length;
    const onTrackStudents = progressData.filter(
      (p) => p.memorization_quality === 'excellent' || p.memorization_quality === 'good'
    ).length;
    return Math.round((onTrackStudents / totalStudents) * 100);
  };

  const getStudentsOnTrack = () => {
    if (!progressData?.length) return 0;
    return progressData.filter(
      (p) => p.memorization_quality === 'excellent' || p.memorization_quality === 'good'
    ).length;
  };

  const getStudentsNeedingReview = () => {
    if (!progressData?.length) return 0;
    return progressData.filter(
      (p) => p.memorization_quality === 'needsWork' || p.memorization_quality === 'horrible'
    ).length;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold mb-2">Progress Tracking</h1>
            <p className="text-gray-500">Monitor student Hifz progress and revisions</p>
          </div>
          <Button>
            <BookOpen className="mr-2" />
            New Progress Entry
          </Button>
        </div>

        <ProgressStats 
          totalStudents={progressData?.length || 0}
          onTrackCount={getStudentsOnTrack()}
          needsReviewCount={getStudentsNeedingReview()}
          overallProgress={calculateOverallProgress()}
        />

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <ProgressTable data={progressData || []} />
        )}
      </div>
    </DashboardLayout>
  );
};

export default Progress;
