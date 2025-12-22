import { useState } from "react";
import { motion } from "framer-motion";
import { Calendar, CheckCircle2, ExternalLink, ArrowRight, Shield, Lock, Eye } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useGoogleCalendarConnection } from "@/hooks/useGoogleCalendarConnection";
import { useToast } from "@/hooks/use-toast";

export default function CalendarOnboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isConnecting, setIsConnecting] = useState(false);

  const { data: connection, isLoading } = useGoogleCalendarConnection();

  const handleConnectGoogle = async () => {
    setIsConnecting(true);
    
    try {
      const redirectUrl = `${window.location.origin}/dashboard/schedules/callback`;
      const { data, error } = await supabase.functions.invoke("google-calendar-auth", {
        body: { action: "authorize", redirectUrl },
      });
      
      if (error) {
        throw new Error(error.message);
      }
      
      if (data?.authUrl) {
        window.location.href = data.authUrl;
      } else {
        throw new Error("Failed to get authorization URL");
      }
    } catch (err) {
      console.error("OAuth error:", err);
      toast({
        title: "Connection failed",
        description: err instanceof Error ? err.message : "Failed to start Google authorization",
        variant: "destructive",
      });
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!connection) return;
    
    try {
      const { error } = await supabase
        .from("google_calendar_connections")
        .delete()
        .eq("id", connection.id);
      
      if (error) throw error;
      
      toast({ title: "Calendar disconnected" });
      window.location.reload();
    } catch (err) {
      toast({ 
        title: "Failed to disconnect", 
        variant: "destructive" 
      });
    }
  };

  // Connected state
  if (connection) {
    const dispatchCalendar = connection.selected_calendars?.[0] || "No calendar selected";
    
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto space-y-6">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="font-display text-2xl lg:text-3xl font-bold mb-2">Calendar Connected</h1>
            <p className="text-muted-foreground">Your dispatch calendar is linked to AnswerAfter</p>
          </motion.div>

          <Card>
            <CardContent className="pt-6 space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{connection.connected_email}</p>
                  <p className="text-sm text-muted-foreground">
                    Connected {connection.connected_at ? new Date(connection.connected_at).toLocaleDateString() : ""}
                  </p>
                </div>
              </div>

              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Dispatch Calendar</p>
                <p className="font-medium">{dispatchCalendar}</p>
              </div>

              <div className="flex gap-3">
                <Button onClick={() => navigate("/dashboard/schedules")} className="flex-1">
                  View Schedules <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Button variant="outline" onClick={handleDisconnect}>
                  Disconnect
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
          <h1 className="font-display text-2xl lg:text-3xl font-bold mb-2">Connect Your Dispatch Calendar</h1>
          <p className="text-muted-foreground">
            Link your Google Calendar so AnswerAfter can schedule emergency dispatch appointments
          </p>
        </motion.div>

        <Alert className="border-primary/20 bg-primary/5">
          <Shield className="h-4 w-4 text-primary" />
          <AlertDescription className="text-foreground">
            <strong>You control your calendar.</strong> AnswerAfter uses secure, minimal access to schedule after-hours emergencies only. We never access personal calendars or modify your existing events.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Google Calendar Integration
            </CardTitle>
            <CardDescription>
              Connect a designated dispatch calendar for emergency scheduling. AnswerAfter will only read availability and create appointments on your selected calendar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Lock className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Secure Authorization</p>
                  <p className="text-sm text-muted-foreground">
                    Grant minimal access via Google OAuth. No admin permissions required.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Calendar className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Select Your Dispatch Calendar</p>
                  <p className="text-sm text-muted-foreground">
                    Choose one calendar for emergency scheduling (e.g., "After-Hours Dispatch", "On-Call Tech")
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Eye className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Limited Access</p>
                  <p className="text-sm text-muted-foreground">
                    AnswerAfter can only read availability and create emergency appointments. No access to other calendars.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-muted/30 rounded-lg text-sm space-y-2">
              <p className="font-medium">What AnswerAfter can do:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
                <li>Read availability on your dispatch calendar</li>
                <li>Create emergency dispatch events</li>
                <li>Update events that AnswerAfter created</li>
              </ul>
              <p className="font-medium mt-3">What AnswerAfter cannot do:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
                <li>Access other calendars on your account</li>
                <li>Modify or delete your existing events</li>
                <li>Request admin or management permissions</li>
              </ul>
            </div>

            <div className="pt-4 border-t">
              <Button 
                size="lg" 
                className="w-full" 
                onClick={handleConnectGoogle}
                disabled={isConnecting || isLoading}
              >
                {isConnecting ? (
                  "Redirecting to Google..."
                ) : (
                  <>
                    Connect Google Calendar
                    <ExternalLink className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-3">
                You'll be redirected to Google to authorize secure access
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
