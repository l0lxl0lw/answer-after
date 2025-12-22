import { useEffect } from "react";
import { motion } from "framer-motion";
import { Calendar, ExternalLink, Settings } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useGoogleCalendarConnection } from "@/hooks/useGoogleCalendarConnection";
import { useNavigate } from "react-router-dom";

export default function Schedules() {
  const navigate = useNavigate();
  const { data: calendarConnection, isLoading } = useGoogleCalendarConnection();

  // Redirect to onboarding if no calendar connection
  useEffect(() => {
    if (!isLoading && !calendarConnection) {
      navigate("/dashboard/schedules/onboarding");
    }
  }, [calendarConnection, isLoading, navigate]);

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

  // Not connected - will redirect
  if (!calendarConnection) {
    return null;
  }

  // Get the calendar ID for embedding
  const calendarId = calendarConnection.selected_calendars?.[0] || "primary";
  const encodedCalendarId = encodeURIComponent(calendarId);
  
  // Google Calendar embed URL
  const embedUrl = `https://calendar.google.com/calendar/embed?src=${encodedCalendarId}&ctz=America/Los_Angeles&mode=WEEK&showTitle=0&showNav=1&showDate=1&showPrint=0&showTabs=1&showCalendars=0&showTz=1`;

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

        <Card>
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
              Appointments booked by AnswerAfter will appear here automatically
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="w-full aspect-[16/10] min-h-[600px]">
              <iframe
                src={embedUrl}
                className="w-full h-full border-0 rounded-b-lg"
                frameBorder="0"
                scrolling="no"
                title="Google Calendar"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
