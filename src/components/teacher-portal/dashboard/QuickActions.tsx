import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { CalendarCheck, BookOpen, Users, CalendarPlus } from "lucide-react";

interface QuickActionsProps {
  teacherId?: string;
}

export const QuickActions = ({ teacherId }: QuickActionsProps) => {
  const navigate = useNavigate();
  
  return (
    <Card className="h-auto">
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <Button 
            variant="outline" 
            className="w-full justify-start text-left text-foreground"
            onClick={() => navigate('/attendance')}
          >
            <CalendarCheck className="mr-2 h-4 w-4" />
            Take Attendance
          </Button>
          
          <Button 
            variant="outline" 
            className="w-full justify-start text-left text-foreground"
            onClick={() => navigate('/student-progress')}
          >
            <BookOpen className="mr-2 h-4 w-4" />
            Record Progress
          </Button>
          
          <Button 
            variant="outline" 
            className="w-full justify-start text-left text-foreground"
            onClick={() => navigate('/teacher-portal?tab=students')}
          >
            <Users className="mr-2 h-4 w-4" />
            View My Students
          </Button>
          
         
        </div>
      </CardContent>
    </Card>
  );
};
