import { useState } from "react";
import { motion } from "framer-motion";
import { Calendar, ExternalLink, Settings, RefreshCw, AlertCircle } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useGoogleCalendarConnection } from "@/hooks/useGoogleCalendarConnection";
import { useOrganization } from "@/hooks/use-api";
import { useNavigate } from "react-router-dom";
import { WeeklyCalendarView } from "@/components/schedules/WeeklyCalendarView";
import { WeekSchedule } from "@/components/settings/BusinessHoursSchedule";

export default function Schedules() {
  const navigate = useNavigate();
  const { data: calendarConnection, isLoading, refetch } = useGoogleCalendarConnection();
  const { data: organization, refetch: refetchOrg } = useOrganization();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([refetch(), refetchOrg()]);
    setIsRefreshing(false);
  };

  // Show loading while checking connection
  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Skeleton className="h-8 w-48" />
        </div>
      </DashboardLayout>
    );
  }

  // Not connected - show connect page
  if (!calendarConnection) {
    return (
      <DashboardLayout>
        <Card className="max-w-lg mx-auto mt-12">
          <CardHeader className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-muted-foreground" />
            </div>
            <CardTitle>Connect Google Account</CardTitle>
            <CardDescription>
              To view and manage your schedule, you need to connect your Google Calendar first. This will allow AnswerAfter to book appointments on your behalf.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => navigate("/dashboard/schedules/onboarding")}>
              Connect Google Account
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  // Get the calendar ID for embedding
  const calendarId = calendarConnection.selected_calendars?.[0] || "primary";
  const encodedCalendarId = encodeURIComponent(calendarId);
  
  // Get business hours schedule from organization
  const businessHours = (organization as any)?.business_hours_schedule as WeekSchedule | null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div>
            <h1 className="font-display text-2xl lg:text-3xl font-bold mb-2">Schedule</h1>
            <p className="text-muted-foreground">
              View and manage your appointments via Google Calendar
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/dashboard/schedules/onboarding")}>
              <Settings className="w-4 h-4 mr-2" />
              Calendar Settings
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`https://calendar.google.com/calendar/r?cid=${encodedCalendarId}`, "_blank")}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Open in Google Calendar
            </Button>
          </div>
        </motion.div>

        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                <CardTitle className="text-lg">Your Schedule</CardTitle>
              </div>
              <p className="text-sm text-muted-foreground">
                Connected: {calendarConnection.connected_email}
              </p>
            </div>
            <CardDescription>
              Appointments booked by AnswerAfter will appear here automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="h-[650px]">
              <WeeklyCalendarView 
                businessHours={businessHours} 
                timezone={organization?.timezone}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
