/**
 * @file src/pages/Dashboard.tsx
 * @summary This file defines the main Dashboard page, which serves as a unified landing page for both Admins and Teachers.
 * 
 * The component dynamically renders content based on the user's role (Admin or Teacher).
 * - For Admins: It displays a tabbed interface with "Overview", "Analytics", and "Messages" sections.
 *   The "Overview" tab includes general admin statistics and a view of the Teacher Dashboard (in admin mode).
 * - For Teachers: It primarily renders the `TeacherDashboard` component, displaying teacher-specific information and tools.
 *
 * Key Functionalities:
 * - Role-based rendering using `useRBAC` hook.
 * - Fetches teacher-specific profile data using `useQuery` if the user is a teacher.
 * - Includes logic to handle cases where a teacher profile might not be found or if access is denied.
 * - Provides loading states while data or role information is being fetched.
 * - Admin view includes an `AdminHeader`, `DashboardStats`, `AdminDashboardTabs`, and `AdminMessaging` components.
 * - Uses `DashboardLayout` for the overall page structure.
 */
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { TeacherDashboard } from "@/components/teacher-portal/TeacherDashboard";
import { useToast } from "@/components/ui/use-toast";
import { LoadingState } from "@/components/teacher-portal/LoadingState";
import { AccessDenied } from "@/components/teacher-portal/AccessDenied";
import { ProfileNotFound } from "@/components/teacher-portal/ProfileNotFound";
import { Teacher } from "@/types/teacher";
import { useRBAC } from "@/hooks/useRBAC";
import { Shield } from "lucide-react";

// Imports for Admin sections (from admin/Dashboard.tsx)
import { AdminHeader } from "@/components/admin/AdminHeader";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { DashboardTabs as AdminDashboardTabs } from "@/components/dashboard/DashboardTabs"; // Renamed to avoid conflict if TeacherDashboard has own tabs
import { WelcomeHeader } from "@/components/dashboard/WelcomeHeader";
import { AdminMessaging } from "@/components/admin/messaging/AdminMessaging";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * @component Dashboard
 * @description The main dashboard page component.
 * 
 * This component acts as a router for displaying different dashboard views based on user role.
 * For admins, it provides a tabbed interface with admin-specific sections and an embedded view of the teacher portal.
 * For teachers, it displays their specific dashboard.
 * 
 * State Management:
 *  - `isCheckingRole`: Boolean to track if the initial role and profile check is in progress.
 *  - `refreshKey`: A number used to trigger re-fetching of teacher profile data.
 *  - `adminActiveTab`: String to manage the active tab in the admin's dashboard view.
 *
 * Hooks:
 *  - `useAuth`: To get the current session and refreshSession function.
 *  - `useToast`: To display notifications.
 *  - `useRBAC`: To determine if the user is a teacher, admin, and the role loading state.
 *  - `useQuery`: To fetch the teacher's profile data if the user is not an admin.
 *  - `useEffect`: To perform an initial check for a teacher's profile and to trigger refetches.
 *
 * Conditional Rendering Logic:
 *  - Shows a `LoadingState` if role/profile data is being fetched (for non-admins).
 *  - If the user is an Admin:
 *    - Renders an admin-specific layout with tabs for "Overview", "Analytics", and "Messages".
 *    - The "Overview" tab includes admin stats and an embedded `TeacherDashboard` with a mock admin profile.
 *  - If the user is a Teacher (and data is loaded):
 *    - Renders the `TeacherDashboard` with their profile data.
 *  - If a non-admin user's teacher profile is not found:
 *    - Renders the `ProfileNotFound` component.
 *  - If a user is neither an admin nor a teacher (after checks complete):
 *    - Renders an `AccessDenied` component.
 *  - A fallback `LoadingState` is shown if none of the above conditions are met, covering edge cases.
 * 
 * @returns {JSX.Element} The rendered dashboard page, tailored to the user's role and data.
 */
const Dashboard = () => { // Renamed from TeacherPortal to Dashboard
  const { session, refreshSession } = useAuth();
  const { toast } = useToast();
  const { isTeacher, isAdmin, isLoading: isRoleLoading } = useRBAC();
  const [isCheckingRole, setIsCheckingRole] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0); // Add a key to force refresh
  const [adminActiveTab, setAdminActiveTab] = useState("overview"); // For admin tabs

  // Moved useQuery for teacherData BEFORE the useEffect that uses its refetch method
  const { 
    data: teacherData, 
    isLoading, 
    error,
    refetch 
  } = useQuery({
    queryKey: ['teacher-profile', session?.user?.email, refreshKey],
    /**
     * @function queryFn (for useQuery)
     * @description Fetches the teacher profile from the 'teachers' table based on the session user's email.
     * This query is disabled for admin users.
     * @async
     * @returns {Promise<Teacher | null>} The teacher's profile data or null if not found or if admin.
     * @throws Will throw an error if the Supabase query fails.
     */
    queryFn: async () => {
      if (!session?.user?.email) return null;
      
      // Skip the query for admin users
      if (isAdmin) {
        console.log("Admin user, skipping teacher profile query");
        return null;
      }
      
      console.log("Fetching teacher profile for email:", session.user.email);
      
      const { data, error } = await supabase
        .from('teachers')
        .select('id, name, subject, email, bio, phone')
        .eq('email', session.user.email)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching teacher profile:', error);
        throw error;
      }
      
      console.log("Teacher profile fetch result:", data);
      return data as Teacher | null;
    },
    enabled: !!session?.user?.email && !isAdmin, // Only enabled for non-admin users
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false // Disable automatic refetch on window focus
  });

  // useEffect for checkTeacherProfile now comes AFTER useQuery for teacherData
  useEffect(() => {
    /**
     * @function checkTeacherProfile
     * @description An async function within useEffect to check if a teacher profile exists for the current user (if not admin).
     * It's intended to ensure that if a teacher record is created externally (e.g., by an admin),
     * the `teacherData` query is refreshed to reflect this.
     * This function is called when the session, refreshKey, isAdmin status changes, or when refetch is available.
     * @async
     */
    const checkTeacherProfile = async () => {
      if (!session?.user?.email) {
        setIsCheckingRole(false);
        return;
      }
      
      try {
        setIsCheckingRole(true);
        console.log("Checking teacher status for email:", session.user.email);
        
        // Skip this check for admin users
        if (isAdmin) {
          console.log("User is admin, skipping teacher profile check");
          setIsCheckingRole(false);
          return;
        }
        
        // Explicitly check if a teacher profile exists in the database
        const { data: teacherExistsData, error: checkError } = await supabase
          .from('teachers')
          .select('id')
          .eq('email', session.user.email)
          .maybeSingle();
          
        if (checkError) throw checkError;
        
        console.log("Teacher profile check result:", teacherExistsData ? "Found" : "Not found");
        
        // Force refetch of the query
        if (teacherExistsData) {
          refetch();
        }
      } catch (error) {
        console.error("Error checking teacher profile:", error);
      } finally {
        setIsCheckingRole(false);
      }
    };
    
    checkTeacherProfile();
  }, [session, refreshKey, isAdmin, refetch]); // Added refetch to dependency array

  /**
   * @function handleRefresh
   * @description Manually triggers a refresh of the session and teacher profile data.
   * It calls `refreshSession` from `useAuth` and updates `refreshKey` to re-trigger the `useQuery` for teacher data.
   * @async
   */
  const handleRefresh = async () => {
    console.log("Refreshing teacher data...");
    await refreshSession();
    setRefreshKey(prev => prev + 1); // Force a refresh of the query
    refetch();
  };

  if (error) {
    console.error("Error loading teacher profile:", error);
    toast({
      title: "Error loading profile",
      description: "Could not load your teacher profile. Please try again later.",
      variant: "destructive"
    });
    // Optionally, return an error component here if needed
  }

  // Show loading state while checking roles or fetching teacher data
  if ((isLoading || isCheckingRole || isRoleLoading) && !isAdmin) {
    return (
      <DashboardLayout>
        <LoadingState />
      </DashboardLayout>
    );
  }

  // If user is admin, they should be able to view the teacher portal with a generic profile
  if (isAdmin) {
    const adminViewProfile: Teacher = {
      id: 'admin-view',
      name: 'Admin View',
      subject: 'Administration',
      email: session?.user?.email || 'admin@example.com',
      bio: 'Viewing the teacher portal as an administrator',
      phone: ''
    };
    
    return (
      <DashboardLayout>
        {/* Admin Header */}
        <AdminHeader title="Combined Dashboard" description="Admin features integrated with teacher view" />
        <WelcomeHeader /> {/* Assuming this is desired for admins */}

        <div className="mt-6"> {/* Added margin for spacing */}
          <Tabs value={adminActiveTab} onValueChange={setAdminActiveTab}>
            <TabsList className="grid w-full max-w-md grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
              <TabsTrigger value="messages">Messages</TabsTrigger>
            </TabsList>
            
            <TabsContent value="overview" className="space-y-6 mt-4">
              {/* Admin-specific overview components */}
              <DashboardStats />
              <AdminDashboardTabs />
              
              {/* Teacher Dashboard content for admin's overview */}
              <div className="mt-6">
                <h2 className="text-xl font-semibold mb-3">Teacher Portal View (Admin Mode)</h2>
                <div className="p-4 mb-6 bg-blue-50 border border-blue-200 rounded-md flex items-center">
                  <Shield className="text-blue-600 mr-3 h-5 w-5 flex-shrink-0" />
                  <p className="text-sm">
                    You are viewing the teacher portal interface with administrator privileges.
                  </p>
                </div>
                <TeacherDashboard teacher={adminViewProfile} />
              </div>
            </TabsContent>
            
            <TabsContent value="analytics" className="mt-4">
              <div className="p-6 rounded-lg border shadow-sm bg-background"> {/* Using bg-background from theme */}
                <h2 className="text-2xl font-semibold mb-4">Analytics</h2>
                <p>Advanced analytics features coming soon...</p>
              </div>
            </TabsContent>
            
            <TabsContent value="messages" className="mt-4">
              <AdminMessaging />
            </TabsContent>
          </Tabs>
        </div>
      </DashboardLayout>
    );
  }

  // Show profile not found if teacher data is missing (for non-admin users)
  if (!teacherData && !isLoading && !isCheckingRole) { // Added checks to prevent showing ProfileNotFound during initial load
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <ProfileNotFound 
            email={session?.user?.email} 
            onRefresh={handleRefresh}
            isAdmin={isAdmin} // This prop might be removable if AccessDenied is used for non-teacher, non-admin
          />
        </div>
      </DashboardLayout>
    );
  }
  
  // This case might be for users who are not admin and not yet identified as teachers, or have no teacher profile
  // Consider if AccessDenied or a different component is more appropriate here.
  if (!isTeacher && !isAdmin && !isRoleLoading && !isCheckingRole) {
      return (
        <DashboardLayout>
            <AccessDenied />
        </DashboardLayout>
      )
  }

  // Show teacher dashboard if we have teacher data (and user is a teacher)
  if (teacherData && isTeacher) { // Added isTeacher check for clarity
    return (
      <DashboardLayout>
        <TeacherDashboard teacher={teacherData} />
      </DashboardLayout>
    );
  }
  
  // Fallback loading or empty state if none of the above conditions are met
  // This might indicate an edge case or a state not fully handled.
  return (
    <DashboardLayout>
      <LoadingState />
    </DashboardLayout>
  );
};

export default Dashboard; // Renamed export 