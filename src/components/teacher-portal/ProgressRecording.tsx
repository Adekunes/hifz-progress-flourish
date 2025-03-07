import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Loader2, Save } from "lucide-react";

interface ProgressRecordingProps {
  teacherId: string;
}

export const ProgressRecording = ({ teacherId }: ProgressRecordingProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Fetch all students from shared database
  const { data: students, isLoading: studentsLoading } = useQuery({
    queryKey: ['all-students-for-progress'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select('name')
        .eq('status', 'active')
        .order('name', { ascending: true });
      
      if (error) {
        console.error('Error fetching students:', error);
        return [];
      }
      
      return data;
    }
  });
  
  // Progress entry form schema
  const formSchema = z.object({
    student_name: z.string({
      required_error: "Please select a student",
    }),
    current_surah: z.coerce.number().min(1).max(114),
    start_ayat: z.coerce.number().min(1),
    end_ayat: z.coerce.number().min(1),
    memorization_quality: z.enum(["excellent", "good", "average", "needsWork", "horrible"]),
    tajweed_level: z.string().min(1, "Tajweed level is required"),
    notes: z.string().optional(),
  });
  
  // Form setup
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      student_name: "",
      current_surah: 1,
      start_ayat: 1,
      end_ayat: 1,
      memorization_quality: "average",
      tajweed_level: "",
      notes: "",
    },
  });
  
  // Handle form submission
  const progressMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      // Get student_id from student_name
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('id')
        .eq('name', values.student_name)
        .single();
      
      if (studentError) {
        throw new Error(`Student not found: ${studentError.message}`);
      }
      
      // Create progress entry
      const { data, error } = await supabase
        .from('progress')
        .insert([{
          student_id: studentData.id,
          teacher_id: teacherId,
          current_surah: values.current_surah,
          start_ayat: values.start_ayat,
          end_ayat: values.end_ayat,
          memorization_quality: values.memorization_quality,
          tajweed_level: values.tajweed_level,
          teacher_notes: values.notes,
          date: new Date().toISOString().split('T')[0],
          verses_memorized: values.end_ayat - values.start_ayat + 1,
        }]);
      
      if (error) {
        throw new Error(`Failed to save progress: ${error.message}`);
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher-summary', teacherId] });
      toast({
        title: "Progress Recorded",
        description: "Student progress has been successfully saved.",
      });
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error Saving Progress",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  function onSubmit(values: z.infer<typeof formSchema>) {
    progressMutation.mutate(values);
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Record Student Progress</CardTitle>
        <CardDescription>
          Document a student's Quran memorization progress
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="student_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Student</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                    disabled={studentsLoading}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a student" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {students?.map((student) => (
                        <SelectItem key={student.name} value={student.name}>
                          {student.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="current_surah"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Surah Number</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} max={114} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="start_ayat"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Starting Ayat</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="end_ayat"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ending Ayat</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="memorization_quality"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Memorization Quality</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select quality" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="excellent">Excellent</SelectItem>
                        <SelectItem value="good">Good</SelectItem>
                        <SelectItem value="average">Average</SelectItem>
                        <SelectItem value="needsWork">Needs Work</SelectItem>
                        <SelectItem value="horrible">Incomplete</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="tajweed_level"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tajweed Level</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Excellent, Good, Needs Practice" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Teacher Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Additional notes about the student's progress, areas for improvement, or specific achievements" 
                      className="min-h-[120px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Button 
              type="submit" 
              className="w-full"
              disabled={progressMutation.isPending}
            >
              {progressMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Record Progress
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};
