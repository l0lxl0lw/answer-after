import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { AlertCircle, Calendar, CheckCircle2, Shield, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface GoogleCalendar {
  id: string;
  summary: string;
  description?: string;
  primary?: boolean;
  backgroundColor?: string;
}

export default function CalendarCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [step, setStep] = useState<"exchanging" | "select-calendar" | "saving" | "complete" | "error">("exchanging");
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);
  const [selectedCalendar, setSelectedCalendar] = useState<string>("");
  const [tokens, setTokens] = useState<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    email: string;
  } | null>(null);
  const [error, setError] = useState<string>("");

  const code = searchParams.get("code");

  useEffect(() => {
    console.log("User state on mount:", {
      userId: user?.id,
      organizationId: user?.organization_id,
      email: user?.email
    });
  }, [user]);

  useEffect(() => {
    if (!code) {
      setError("No authorization code received from Google");
      setStep("error");
      return;
    }

    exchangeCodeForTokens();
  }, [code]);

  const exchangeCodeForTokens = async () => {
    try {
      const redirectUrl = `${window.location.origin}/dashboard/schedules/callback`;
      
      const { data, error: fnError } = await supabase.functions.invoke("google-calendar-auth", {
        body: { 
          action: "callback", 
          code,
          redirectUrl,
        },
      });

      if (fnError || data?.error) {
        throw new Error(data?.error || fnError?.message || "Failed to exchange code");
      }

      setTokens({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresIn: data.expiresIn,
        email: data.email,
      });

      // Now fetch available calendars
      await fetchCalendars(data.accessToken);
    } catch (err) {
      console.error("Token exchange error:", err);
      setError(err instanceof Error ? err.message : "Failed to connect to Google");
      setStep("error");
    }
  };

  const fetchCalendars = async (accessToken: string) => {
    try {
      const response = await fetch(
        "https://www.googleapis.com/calendar/v3/users/me/calendarList",
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error.message || "Failed to fetch calendars");
      }

      // Filter to calendars user can write to
      const writableCalendars = data.items?.filter(
        (cal: GoogleCalendar & { accessRole?: string }) => 
          cal.accessRole === "owner" || cal.accessRole === "writer"
      ) || [];

      setCalendars(writableCalendars);
      setStep("select-calendar");
    } catch (err) {
      console.error("Calendar fetch error:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch calendars");
      setStep("error");
    }
  };

  const handleSaveConnection = async () => {
    console.log("Save connection called with:", {
      selectedCalendar,
      hasTokens: !!tokens,
      organizationId: user?.organization_id
    });

    if (!selectedCalendar) {
      toast({
        title: "Missing information",
        description: "Please select a calendar to continue",
        variant: "destructive"
      });
      return;
    }

    if (!tokens) {
      toast({
        title: "Session expired",
        description: "Please reconnect your Google Calendar",
        variant: "destructive"
      });
      navigate("/dashboard/schedules/onboarding");
      return;
    }

    if (!user?.organization_id) {
      toast({
        title: "Organization not found",
        description: "Please complete your organization setup",
        variant: "destructive"
      });
      navigate("/dashboard");
      return;
    }

    setStep("saving");

    try {
      const { error: fnError } = await supabase.functions.invoke("google-calendar-auth", {
        body: {
          action: "save-connection",
          organizationId: user.organization_id,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.expiresIn,
          email: tokens.email,
          calendarId: selectedCalendar,
        },
      });

      if (fnError) {
        throw new Error(fnError.message || "Failed to save connection");
      }

      setStep("complete");
      toast({ title: "Calendar connected successfully" });
      
      // Redirect after a brief moment
      setTimeout(() => {
        navigate("/dashboard/schedules");
      }, 2000);
    } catch (err) {
      console.error("Save connection error:", err);
      setError(err instanceof Error ? err.message : "Failed to save connection");
      setStep("error");
    }
  };

  const selectedCalendarInfo = calendars.find(c => c.id === selectedCalendar);

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {step === "exchanging" && (
          <Card>
            <CardContent className="py-12">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-muted-foreground">Connecting to Google Calendar...</p>
              </div>
            </CardContent>
          </Card>
        )}

        {step === "select-calendar" && (
          <>
            <div>
              <h1 className="font-display text-2xl lg:text-3xl font-bold mb-2">
                Select Your Calendar
              </h1>
              <p className="text-muted-foreground">
                Choose the calendar AnswerAfter will use for appointment scheduling.
              </p>
            </div>

            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                <strong>You control your calendar.</strong> AnswerAfter only reads availability and creates appointments on your selected calendar. We never access other calendars or modify existing events.
              </AlertDescription>
            </Alert>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  Select Your Appointment Calendar
                </CardTitle>
                <CardDescription>
                  This calendar becomes the source for scheduling appointments booked through AnswerAfter.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {tokens?.email && (
                  <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span className="text-sm">Connected as <strong>{tokens.email}</strong></span>
                  </div>
                )}

                <RadioGroup
                  value={selectedCalendar}
                  onValueChange={(value) => {
                    console.log("Calendar selected:", value);
                    setSelectedCalendar(value);
                  }}
                >
                  <div className="space-y-3">
                    {calendars.map((cal) => (
                      <div
                        key={cal.id}
                        className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                          selectedCalendar === cal.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                        onClick={() => {
                          console.log("Calendar clicked:", cal.id, cal.summary);
                          setSelectedCalendar(cal.id);
                        }}
                      >
                        <RadioGroupItem value={cal.id} id={cal.id} />
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: cal.backgroundColor || "#4285f4" }}
                        />
                        <Label htmlFor={cal.id} className="flex-1 cursor-pointer">
                          <div className="font-medium">
                            {cal.summary}
                            {cal.primary && (
                              <span className="ml-2 text-xs text-muted-foreground">(Primary)</span>
                            )}
                          </div>
                          {cal.description && (
                            <p className="text-sm text-muted-foreground">{cal.description}</p>
                          )}
                        </Label>
                      </div>
                    ))}
                  </div>
                </RadioGroup>

                {calendars.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No writable calendars found</p>
                  </div>
                )}

                <div className="pt-4 border-t space-y-4">
                  <div className="text-sm text-muted-foreground space-y-2">
                    <p><strong>What AnswerAfter can do:</strong></p>
                    <ul className="list-disc list-inside space-y-1 pl-2">
                      <li>Read availability on this calendar</li>
                      <li>Create appointment events</li>
                      <li>Update events that AnswerAfter created</li>
                    </ul>
                    <p className="mt-3"><strong>What AnswerAfter cannot do:</strong></p>
                    <ul className="list-disc list-inside space-y-1 pl-2">
                      <li>Access other calendars</li>
                      <li>Modify or delete your existing events</li>
                      <li>View personal or sensitive calendar data</li>
                    </ul>
                  </div>

                  <Button 
                    size="lg" 
                    className="w-full" 
                    onClick={handleSaveConnection}
                    disabled={!selectedCalendar}
                  >
                    Confirm Calendar Selection
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {step === "saving" && (
          <Card>
            <CardContent className="py-12">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-muted-foreground">Saving your calendar connection...</p>
              </div>
            </CardContent>
          </Card>
        )}

        {step === "complete" && (
          <Card>
            <CardContent className="py-12">
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-primary" />
                </div>
                <div className="text-center">
                  <h2 className="text-xl font-semibold mb-2">Calendar Connected!</h2>
                  <p className="text-muted-foreground">
                    "{selectedCalendarInfo?.summary}" is now your appointment calendar
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">Redirecting to schedule...</p>
              </div>
            </CardContent>
          </Card>
        )}

        {step === "error" && (
          <Card>
            <CardContent className="py-12">
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertCircle className="w-8 h-8 text-destructive" />
                </div>
                <div className="text-center">
                  <h2 className="text-xl font-semibold mb-2">Connection Failed</h2>
                  <p className="text-muted-foreground">{error}</p>
                </div>
                <Button variant="outline" onClick={() => navigate("/dashboard/schedules/onboarding")}>
                  Try Again
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
