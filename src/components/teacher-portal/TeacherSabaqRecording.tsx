import React, { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form.tsx";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client.ts";
import { useToast } from "@/hooks/use-toast.ts";
import { StudentStatusList } from "./StudentStatusList.tsx";

// Define the form schema
const formSchema = z.object({
  student_id: z.string({
    required_error: "Please select a student",
  }),
  current_surah: z.coerce.number().min(1).max(114),
  start_ayat: z.coerce.number().min(1),
  end_ayat: z.coerce.number().min(1),
  page_start: z.coerce.number().min(1).optional(),
  page_end: z.coerce.number().min(1).optional(),
  pages_memorized: z.coerce.number().min(0).optional(),
  verses_memorized: z.coerce.number().min(1),
  memorization_quality: z.enum([
    "excellent",
    "good",
    "average",
    "needsWork",
    "horrible",
  ]),
  mistake_count: z.coerce.number().min(0).optional(),
  is_new_lesson: z.boolean().default(true),
  lesson_type: z.enum(["hifz", "nazirah", "qaida"]).default("hifz"),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface Student {
  id: string;
  name: string;
}

interface TeacherSabaqRecordingProps {
  teacherId: string;
}

export const TeacherSabaqRecording: React.FC<TeacherSabaqRecordingProps> = (
  { teacherId },
) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      student_id: "",
      current_surah: 1,
      start_ayat: 1,
      end_ayat: 1,
      verses_memorized: 0,
      memorization_quality: "good",
      mistake_count: 0,
      is_new_lesson: true,
      lesson_type: "hifz",
      notes: "",
    },
  });

  // Fetch students assigned to this teacher
  useEffect(() => {
    const fetchStudents = async () => {
      const { data, error } = await supabase
        .from("students_teachers")
        .select("student_name, id")
        .eq("teacher_id", teacherId)
        .eq("active", true);

      if (error) {
        console.error("Error fetching students:", error);
        return;
      }

      if (data) {
        setStudents(data.map((st) => ({
          id: st.id,
          name: st.student_name,
        })));
      }
    };

    fetchStudents();
  }, [teacherId]);

  const onSubmit = async (values: FormValues) => {
    setIsLoading(true);
    try {
      // Calculate auto_rating based on mistake_count
      let autoRating = "excellent";
      const mistakes = values.mistake_count || 0;

      if (mistakes === 0) {
        autoRating = "excellent";
      } else if (mistakes >= 1 && mistakes <= 3) {
        autoRating = "good";
      } else if (mistakes >= 4 && mistakes <= 7) {
        autoRating = "average";
      } else if (mistakes >= 8 && mistakes <= 12) {
        autoRating = "needsWork";
      } else {
        autoRating = "horrible";
      }

      let pagesMemorized = values.pages_memorized || 0;
      if (values.page_start && values.page_end && values.page_end >= values.page_start) {
        pagesMemorized = values.page_end - values.page_start + 1;
      }

      // Format and save the data
      const progressData = {
        student_id: values.student_id,
        date: new Date().toISOString().split("T")[0],
        current_surah: values.current_surah,
        current_juz: 1, // Would need to calculate or add to form
        start_ayat: values.start_ayat,
        end_ayat: values.end_ayat,
        verses_memorized: values.verses_memorized,
        pages_memorized: pagesMemorized,
        memorization_quality: values.memorization_quality,
        page_start: values.page_start,
        page_end: values.page_end,
        mistake_count: values.mistake_count,
        auto_rating: autoRating,
        is_new_lesson: values.is_new_lesson,
        lesson_type: values.lesson_type,
        notes: values.notes,
        teacher_id: teacherId,
      };

      const { error } = await supabase
        .from("progress")
        .insert([progressData]);

      if (error) throw error;

      toast({
        title: "Progress recorded successfully",
        description: "The student's progress has been saved.",
      });

      form.reset();
    } catch (error) {
      console.error("Error saving progress:", error);
      toast({
        variant: "destructive",
        title: "Failed to record progress",
        description: "There was an error saving the data. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Record Student Progress
        </h2>
        <p className="text-muted-foreground">
          Track daily sabaq and lessons for your students
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Record New Lesson</CardTitle>
            <CardDescription>
              Record a student's daily sabaq and learning progress
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="student_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Student</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a student" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {students.map((student) => (
                            <SelectItem key={student.id} value={student.id}>
                              {student.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="lesson_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lesson Type</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select lesson type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="hifz">Hifz</SelectItem>
                          <SelectItem value="nazirah">Nazirah</SelectItem>
                          <SelectItem value="qaida">Qaida</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="current_surah"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Surah</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="e.g. 2" {...field} />
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
                        <FormLabel>Start Ayat</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="e.g. 1" {...field} />
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
                        <FormLabel>End Ayat</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="e.g. 5" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="page_start"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Page</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="e.g. 120" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="page_end"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Page</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="e.g. 121" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <FormField
                    control={form.control}
                    name="verses_memorized"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total Verses</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="e.g. 5" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                   <FormField
                    control={form.control}
                    name="pages_memorized"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pages (if no range)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="e.g. 1" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="memorization_quality"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teacher Rating</FormLabel>
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
                          <SelectItem value="horrible">Horrible</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="mistake_count"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Number of Mistakes</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Any comments on the student's performance..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "Saving..." : "Record Progress"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Daily Status</CardTitle>
              <CardDescription>
                Live overview of student lesson statuses for today
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StudentStatusList teacherId={teacherId} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
