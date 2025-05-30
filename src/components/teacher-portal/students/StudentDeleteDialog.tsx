
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";

interface StudentDeleteDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  studentToDelete: { id: string, name: string, studentId: string } | null;
  isDeleteType: 'remove' | 'delete';
  teacherId: string;
}

export const StudentDeleteDialog = ({
  isOpen,
  setIsOpen,
  studentToDelete,
  isDeleteType,
  teacherId
}: StudentDeleteDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const removeStudentMutation = useMutation({
    mutationFn: async ({ assignmentId }: { assignmentId: string }) => {
      const { error } = await supabase
        .from('students_teachers')
        .delete()
        .eq('id', assignmentId);
      
      if (error) throw error;
      return assignmentId;
    },
    onSuccess: () => {
      toast({
        title: "Student removed",
        description: `${studentToDelete?.name} has been removed from your students.`,
      });
      
      queryClient.invalidateQueries({ queryKey: ['teacher-student-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['teacher-students-details'] });
      setIsOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to remove student: ${error.message}`,
        variant: "destructive"
      });
    },
  });
  
  const deleteStudentMutation = useMutation({
    mutationFn: async (studentId: string) => {
      // First, remove any student-teacher relationships
      const { error: relationshipError } = await supabase
        .from('students_teachers')
        .delete()
        .eq('student_name', studentToDelete?.name || '');
      
      if (relationshipError) throw relationshipError;
      
      // Then delete the student
      const { error } = await supabase
        .from('students')
        .delete()
        .eq('id', studentId);
      
      if (error) throw error;
      return studentId;
    },
    onSuccess: () => {
      toast({
        title: "Student deleted",
        description: `${studentToDelete?.name} has been permanently deleted from the database.`,
      });
      queryClient.invalidateQueries({ queryKey: ['teacher-student-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['teacher-students-details'] });
      setIsOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete student: ${error.message}`,
        variant: "destructive"
      });
    },
  });
  
  const handleConfirmDelete = () => {
    if (studentToDelete) {
      if (isDeleteType === 'delete') {
        deleteStudentMutation.mutate(studentToDelete.studentId);
      } else {
        removeStudentMutation.mutate({ assignmentId: studentToDelete.id });
      }
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{isDeleteType === 'delete' ? 'Delete Student' : 'Remove Student'}</AlertDialogTitle>
          <AlertDialogDescription>
            {isDeleteType === 'delete' ? (
              <>
                Are you sure you want to delete {studentToDelete?.name}? This action cannot be undone and will permanently remove the student from the database.
              </>
            ) : (
              <>
                Are you sure you want to remove {studentToDelete?.name} from your students? This will only remove the assignment, not delete the student from the system.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleConfirmDelete}
            className="bg-red-600 text-white hover:bg-red-700"
          >
            {deleteStudentMutation.isPending || removeStudentMutation.isPending ? 
              (isDeleteType === 'delete' ? "Deleting..." : "Removing...") : 
              (isDeleteType === 'delete' ? "Delete" : "Remove")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
