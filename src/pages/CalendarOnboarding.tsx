import { useState } from "react";
import { motion } from "framer-motion";
import { Calendar, CheckCircle2, ExternalLink, ArrowRight } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export default function CalendarOnboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isConnecting, setIsConnecting] = useState(false);

  // Check if calendar is already connected
  const { data: connection, isLoading } = useQuery({
    queryKey: ["google-calendar-connection"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("google_calendar_connections")
        .select("*")
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const handleConnectGoogle = async () => {
    setIsConnecting(true);
    // This will redirect to the OAuth flow handled by an edge function
    const redirectUrl = `${window.location.origin}/dashboard/schedules/callback`;
    const { data } = await supabase.functions.invoke("google-calendar-auth", {
      body: { action: "authorize", redirectUrl },
    });
    
    if (data?.authUrl) {
      window.location.href = data.authUrl;
    } else {
      setIsConnecting(false);
    }
  };

  if (connection) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto space-y-6">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="font-display text-2xl lg:text-3xl font-bold mb-2">Calendar Connected</h1>
            <p className="text-muted-foreground">Your Google Calendar is linked to AnswerAfter</p>
          </motion.div>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{connection.connected_email}</p>
                  <p className="text-sm text-muted-foreground">
                    Connected {new Date(connection.connected_at).toLocaleDateString()}
                  </p>
                </div>
                <Button onClick={() => navigate("/dashboard/schedules")}>
                  View Schedules <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-2xl lg:text-3xl font-bold mb-2">Connect Your Calendar</h1>
          <p className="text-muted-foreground">
            Sync your Google Calendar to manage technician schedules and on-call rotations
          </p>
        </motion.div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Google Calendar Integration
            </CardTitle>
            <CardDescription>
              Connect your company's Google Calendar to display technician availability and on-call schedules directly in AnswerAfter.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-sm font-semibold text-primary">1</span>
                </div>
                <div>
                  <p className="font-medium">Authorize Access</p>
                  <p className="text-sm text-muted-foreground">
                    Grant AnswerAfter read-only access to view your calendars
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-sm font-semibold text-primary">2</span>
                </div>
                <div>
                  <p className="font-medium">Select Calendars</p>
                  <p className="text-sm text-muted-foreground">
                    Choose which calendars to display for scheduling
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-sm font-semibold text-primary">3</span>
                </div>
                <div>
                  <p className="font-medium">View Schedules</p>
                  <p className="text-sm text-muted-foreground">
                    See all your events directly in the Schedules page
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t">
              <Button 
                size="lg" 
                className="w-full" 
                onClick={handleConnectGoogle}
                disabled={isConnecting || isLoading}
              >
                {isConnecting ? (
                  "Connecting..."
                ) : (
                  <>
                    Connect Google Calendar
                    <ExternalLink className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-3">
                We only request read access to your calendars. Your data is secure.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
