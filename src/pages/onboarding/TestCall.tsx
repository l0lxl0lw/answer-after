import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Phone, CheckCircle2, Loader2, MessageSquare, User, Bot } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { COMPANY } from "@/lib/constants";
import { formatPhoneDisplay } from "@/lib/phoneUtils";
import { useQueryClient } from "@tanstack/react-query";
import { createLogger } from "@/lib/logger";

const log = createLogger('TestCall');

interface TranscriptMessage {
  id: string;
  speaker: string;
  content: string;
  timestamp_ms: number | null;
}

export default function TestCall() {
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [callDetected, setCallDetected] = useState(false);
  const [callId, setCallId] = useState<string | null>(null);
  const [callStatus, setCallStatus] = useState<string | null>(null);
  const [transcripts, setTranscripts] = useState<TranscriptMessage[]>([]);
  const [isCompleting, setIsCompleting] = useState(false);

  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    loadPhoneNumber();
  }, [user?.organization_id]);

  // Auto-scroll transcripts
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcripts]);

  // Listen for new calls via realtime + polling fallback
  useEffect(() => {
    if (!isListening || !user?.organization_id) return;

    log.debug('Setting up call listener for org:', user.organization_id);
    const startTime = new Date().toISOString();

    // Realtime subscription
    const channel = supabase
      .channel("test-call-listener")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "calls",
          filter: `organization_id=eq.${user.organization_id}`,
        },
        (payload) => {
          log.debug("New call detected via realtime!", payload);
          handleCallDetected(payload.new as any);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "calls",
          filter: `organization_id=eq.${user.organization_id}`,
        },
        (payload) => {
          log.debug("Call updated:", payload);
          const call = payload.new as any;
          if (call.id === callId) {
            setCallStatus(call.status);
            if (call.status === 'completed') {
              handleCallCompleted();
            }
          }
        }
      )
      .subscribe();

    // Polling fallback - check for new calls every 3 seconds
    const pollInterval = setInterval(async () => {
      if (callDetected) return; // Already detected

      try {
        const { data: recentCalls } = await supabase
          .from('calls')
          .select('*')
          .eq('organization_id', user.organization_id)
          .gte('created_at', startTime)
          .order('created_at', { ascending: false })
          .limit(1);

        if (recentCalls && recentCalls.length > 0) {
          log.debug("New call detected via polling!", recentCalls[0]);
          handleCallDetected(recentCalls[0]);
        }
      } catch (error) {
        log.error('Polling error:', error);
      }
    }, 3000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [isListening, user?.organization_id, callId, callDetected]);

  // Listen for transcripts when call is active
  useEffect(() => {
    if (!callId) return;

    log.debug('Setting up transcript listener for call:', callId);

    const channel = supabase
      .channel("test-call-transcripts")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "call_transcripts",
          filter: `call_id=eq.${callId}`,
        },
        (payload) => {
          log.debug("New transcript:", payload);
          const transcript = payload.new as TranscriptMessage;
          setTranscripts((prev) => [...prev, transcript]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [callId]);

  const loadPhoneNumber = async () => {
    if (!user?.organization_id) return;

    try {
      const { data } = await supabase
        .from("phone_numbers")
        .select("phone_number")
        .eq("organization_id", user.organization_id)
        .eq("is_active", true)
        .maybeSingle();

      if (data) {
        setPhoneNumber(data.phone_number);
      }
    } catch (error) {
      log.error("Error loading phone number:", error);
    }
  };

  const handleStartListening = () => {
    setIsListening(true);
    setTranscripts([]);
    setCallId(null);
    setCallStatus(null);
    toast({
      title: "Listening for calls",
      description: "Go ahead and call your new number!",
    });
  };

  const handleCallDetected = async (call: any) => {
    setCallDetected(true);
    setCallId(call.id);
    setCallStatus(call.status);

    toast({
      title: "Call connected!",
      description: "Your AI agent is now talking to you.",
    });
  };

  const handleCallCompleted = async () => {
    setIsListening(false);

    toast({
      title: "Call completed!",
      description: "Great! Your AI agent is working perfectly.",
    });

    // Wait a moment to show the final transcripts
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Mark onboarding as complete
    completeOnboarding();
  };

  const completeOnboarding = async () => {
    if (!user?.organization_id) return;

    setIsCompleting(true);

    try {
      const { error } = await supabase
        .from("organizations")
        .update({
          is_onboarding_complete: true,
          onboarding_completed_at: new Date().toISOString(),
        })
        .eq("id", user.organization_id);

      if (error) {
        throw error;
      }

      toast({
        title: "Setup complete!",
        description: "Welcome to AnswerAfter. Let's go to your dashboard.",
      });

      await queryClient.invalidateQueries({ queryKey: ['onboarding-status'] });

      setTimeout(() => {
        window.location.href = "/dashboard?welcome=true";
      }, 1500);
    } catch (error) {
      log.error("Error completing onboarding:", error);
      toast({
        title: "Error",
        description: "Failed to complete setup. Please try again.",
        variant: "destructive",
      });
      setIsCompleting(false);
    }
  };

  const handleSkip = () => {
    completeOnboarding();
  };

  const handleFinishEarly = () => {
    // Allow user to finish even if call hasn't completed
    completeOnboarding();
  };

  if (!phoneNumber) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading your phone number...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display font-semibold text-lg">{COMPANY.nameCamelCase}</h1>
              <p className="text-sm text-muted-foreground">Step 4 of 5 • Test your AI agent</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Intro */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
            <Phone className="w-8 h-8 text-success" />
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold mb-3">
            Test Your AI Agent
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Give your new number a call to hear your AI agent in action!
          </p>
        </motion.div>

        {/* Phone Number Display */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-primary/10 to-accent/10 border-2 border-primary rounded-xl p-8 mb-6 text-center"
        >
          <p className="text-sm text-muted-foreground mb-2">Your AI-Powered Number</p>
          <a
            href={`tel:${phoneNumber}`}
            className="text-4xl font-bold text-primary hover:text-primary/80 transition-colors inline-block"
          >
            {formatPhoneDisplay(phoneNumber)}
          </a>
          <p className="text-sm text-muted-foreground mt-4">
            Tap to call from your mobile device
          </p>
        </motion.div>

        <AnimatePresence mode="wait">
          {!isListening && !callDetected && (
            <motion.div
              key="start"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ delay: 0.2 }}
              className="space-y-6"
            >
              {/* Instructions */}
              <div className="bg-card border rounded-xl p-6">
                <h3 className="font-semibold mb-3">What to expect:</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">1.</span>
                    <span>Your AI agent will greet you professionally</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">2.</span>
                    <span>Try asking about your services or booking an appointment</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">3.</span>
                    <span>You'll see the conversation transcript in real-time</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">4.</span>
                    <span>Hang up when you're done to complete setup</span>
                  </li>
                </ul>
              </div>

              {/* Start Button */}
              <Button
                size="lg"
                className="w-full"
                onClick={() => {
                  toast({
                    title: "Great!",
                    description: "Your AI agent is ready. Completing setup...",
                  });
                  completeOnboarding();
                }}
              >
                <CheckCircle2 className="w-5 h-5 mr-2" />
                I've Verified It Works
              </Button>

              {/* Skip Option */}
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground"
                onClick={handleSkip}
              >
                Skip for now
              </Button>
            </motion.div>
          )}

          {isListening && !callDetected && (
            <motion.div
              key="listening"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-4"
            >
              <div className="bg-card border-2 border-primary rounded-xl p-8 text-center">
                <div className="relative w-24 h-24 mx-auto mb-4">
                  <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
                  <div className="relative w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center">
                    <Phone className="w-12 h-12 text-primary animate-pulse" />
                  </div>
                </div>
                <h3 className="font-display text-xl font-bold mb-2">
                  Listening for your call...
                </h3>
                <p className="text-muted-foreground mb-2">
                  Go ahead and call{" "}
                  <span className="font-semibold text-foreground">
                    {formatPhoneDisplay(phoneNumber)}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  We'll automatically detect when your call connects
                </p>
              </div>

              {/* Manual confirmation option */}
              <div className="bg-muted/50 border rounded-xl p-4">
                <p className="text-sm text-muted-foreground mb-3 text-center">
                  Already made a test call and heard the AI agent?
                </p>
                <Button
                  variant="default"
                  className="w-full"
                  onClick={() => {
                    toast({
                      title: "Great!",
                      description: "Your AI agent is ready. Completing setup...",
                    });
                    completeOnboarding();
                  }}
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Yes, I've Tested My Agent
                </Button>
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsListening(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={handleSkip}
                >
                  Skip test call
                </Button>
              </div>
            </motion.div>
          )}

          {callDetected && (
            <motion.div
              key="active-call"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-4"
            >
              {/* Call Status */}
              <div className="bg-success/10 border-2 border-success rounded-xl p-6 text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className="w-3 h-3 bg-success rounded-full animate-pulse" />
                  <span className="font-semibold text-success">
                    {callStatus === 'completed' ? 'Call Completed' : 'Call In Progress'}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {callStatus === 'completed'
                    ? 'Your AI agent handled the call successfully!'
                    : 'Your AI agent is talking to you now'}
                </p>
              </div>

              {/* Live Transcript */}
              <div className="bg-card border rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b bg-muted/50 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium text-sm">Live Transcript</span>
                  {transcripts.length === 0 && callStatus !== 'completed' && (
                    <Loader2 className="w-3 h-3 animate-spin ml-auto text-muted-foreground" />
                  )}
                </div>
                <div className="p-4 max-h-[300px] overflow-y-auto space-y-3">
                  {transcripts.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {callStatus === 'completed'
                        ? 'No transcript available for this call'
                        : 'Waiting for conversation to start...'}
                    </p>
                  ) : (
                    transcripts.map((msg) => (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex gap-2 ${
                          msg.speaker === 'agent' ? 'justify-start' : 'justify-end'
                        }`}
                      >
                        {msg.speaker === 'agent' && (
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Bot className="w-3 h-3 text-primary" />
                          </div>
                        )}
                        <div
                          className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                            msg.speaker === 'agent'
                              ? 'bg-muted'
                              : 'bg-primary text-primary-foreground'
                          }`}
                        >
                          {msg.content}
                        </div>
                        {msg.speaker !== 'agent' && (
                          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                            <User className="w-3 h-3 text-primary-foreground" />
                          </div>
                        )}
                      </motion.div>
                    ))
                  )}
                  <div ref={transcriptEndRef} />
                </div>
              </div>

              {/* Actions */}
              {callStatus === 'completed' ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-4"
                >
                  <div className="bg-success/10 border border-success/20 rounded-lg p-4 text-center">
                    <CheckCircle2 className="w-8 h-8 text-success mx-auto mb-2" />
                    <p className="font-medium">Test Complete!</p>
                    <p className="text-sm text-muted-foreground">
                      Your AI agent is ready to take real calls.
                    </p>
                  </div>
                  {isCompleting ? (
                    <div className="flex items-center justify-center gap-2 py-4">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      <span className="text-muted-foreground">Completing setup...</span>
                    </div>
                  ) : (
                    <Button size="lg" className="w-full" onClick={completeOnboarding}>
                      Continue to Dashboard
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                  )}
                </motion.div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleFinishEarly}
                >
                  Finish & Continue
                </Button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Info Box */}
        {!callDetected && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-info/10 border border-info/20 rounded-lg p-4 mt-6"
          >
            <p className="text-sm text-muted-foreground">
              💡 <strong>Pro tip:</strong> After setup, you can view all your calls, transcripts, and appointments from your dashboard.
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
