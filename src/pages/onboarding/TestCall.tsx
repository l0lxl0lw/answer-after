import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Phone, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { COMPANY } from "@/lib/constants";
import { formatPhoneDisplay } from "@/lib/phoneUtils";
import { useQueryClient } from "@tanstack/react-query";

export default function TestCall() {
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [callDetected, setCallDetected] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    loadPhoneNumber();
  }, [user?.organization_id]);

  useEffect(() => {
    if (isListening) {
      // Set up real-time subscription for new calls
      const channel = supabase
        .channel("test-call-listener")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "calls",
            filter: `organization_id=eq.${user?.organization_id}`,
          },
          (payload) => {
            console.log("New call detected!", payload);
            handleCallDetected();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isListening, user?.organization_id]);

  const loadPhoneNumber = async () => {
    if (!user?.organization_id) return;

    try {
      const { data } = await supabase
        .from("phone_numbers")
        .select("phone_number")
        .eq("organization_id", user.organization_id)
        .eq("is_active", true)
        .single();

      if (data) {
        setPhoneNumber(data.phone_number);
      }
    } catch (error) {
      console.error("Error loading phone number:", error);
    }
  };


  const handleStartListening = () => {
    setIsListening(true);
    toast({
      title: "Listening for calls",
      description: "Go ahead and call your new number!",
    });
  };

  const handleCallDetected = async () => {
    setCallDetected(true);
    setIsListening(false);

    toast({
      title: "Call detected!",
      description: "Great! Your AI agent is working perfectly.",
    });

    // Wait a moment for dramatic effect
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

      // Invalidate queries to ensure fresh data on next load
      await queryClient.invalidateQueries({ queryKey: ['onboarding-status'] });

      // Use window.location.href for full page reload to bypass cache issues
      setTimeout(() => {
        window.location.href = "/dashboard?welcome=true";
      }, 1500);
    } catch (error) {
      console.error("Error completing onboarding:", error);
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
              <p className="text-sm text-muted-foreground">Step 5 of 6 • Test your AI agent</p>
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
                    <span>The agent will respond naturally and helpfully</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">4.</span>
                    <span>We'll detect the call and complete your setup</span>
                  </li>
                </ul>
              </div>

              {/* Start Button */}
              <Button
                size="lg"
                className="w-full"
                onClick={handleStartListening}
              >
                <Phone className="w-5 h-5 mr-2" />
                I'm Ready to Call
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
              className="bg-card border-2 border-primary rounded-xl p-8 text-center"
            >
              <div className="relative w-24 h-24 mx-auto mb-4">
                <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
                <div className="relative w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center">
                  <Phone className="w-12 h-12 text-primary animate-pulse" />
                </div>
              </div>
              <h3 className="font-display text-xl font-bold mb-2">
                Listening for your call...
              </h3>
              <p className="text-muted-foreground">
                Go ahead and call{" "}
                <span className="font-semibold text-foreground">
                  {formatPhoneDisplay(phoneNumber)}
                </span>
              </p>
            </motion.div>
          )}

          {callDetected && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="bg-success/10 border-2 border-success rounded-xl p-8 text-center"
            >
              <CheckCircle2 className="w-16 h-16 text-success mx-auto mb-4" />
              <h3 className="font-display text-2xl font-bold mb-2">
                Perfect! Call Detected
              </h3>
              <p className="text-muted-foreground mb-4">
                Your AI agent is working beautifully. Completing your setup...
              </p>
              {isCompleting && (
                <Loader2 className="w-6 h-6 animate-spin text-success mx-auto" />
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
