
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useRealtimeAnalytics = (teacherId: string, timeRange: string) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  useEffect(() => {
    const channel = supabase
      .channel('analytics-updates')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen for all events
          schema: 'public',
          table: 'progress'
        },
        (payload) => {
          console.log('Real-time update received:', payload);
          
          // Invalidate the query to fetch fresh data
          queryClient.invalidateQueries({ queryKey: ['teacher-analytics', teacherId, timeRange] });
          
          // Show toast notification about the update
          toast({
            title: "Data Updated",
            description: "Analytics data has been refreshed in real-time.",
            duration: 3000,
          });
        }
      )
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [teacherId, timeRange, queryClient, toast]);
};
