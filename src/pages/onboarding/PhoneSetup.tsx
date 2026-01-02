import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Phone,
  Loader2,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { COMPANY } from "@/lib/constants";
import {
  formatPhoneNumber,
  isValidPhoneNumber,
  extractAreaCode,
  formatPhoneDisplay,
} from "@/lib/phoneUtils";

export default function PhoneSetup() {
  const [businessPhone, setBusinessPhone] = useState("");
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [foundNumber, setFoundNumber] = useState<string | null>(null);

  const navigate = useNavigate();
  const { toast } = useToast();
  const { session, user, isLoading: authLoading } = useAuth();

  // Check if user already has a phone number
  const { data: existingPhone } = useQuery({
    queryKey: ["existing-phone", user?.institution_id],
    queryFn: async () => {
      if (!user?.institution_id) return null;

      const { data } = await supabase
        .from("phone_numbers")
        .select("phone_number")
        .eq("institution_id", user.institution_id)
        .eq("is_active", true)
        .maybeSingle();

      return data;
    },
    enabled: !!user?.institution_id,
  });

  const handleBusinessPhoneChange = (value: string) => {
    // Format as user types
    const formatted = formatPhoneNumber(value);
    setBusinessPhone(formatted);
    setFoundNumber(null);
  };

  const handlePurchase = async () => {
    // Wait for auth to load
    if (authLoading) {
      toast({
        title: "Loading",
        description: "Please wait while we verify your session...",
      });
      return;
    }

    if (!session?.access_token) {
      toast({
        title: "Authentication required",
        description: "Please log in to continue.",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    if (!user?.institution_id) {
      toast({
        title: "Setup incomplete",
        description: "Institution not found. Please try logging in again.",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    // Validate phone number
    if (!isValidPhoneNumber(businessPhone)) {
      toast({
        title: "Invalid phone number",
        description: "Please enter a valid 10-digit US phone number.",
        variant: "destructive",
      });
      return;
    }

    const areaCode = extractAreaCode(businessPhone);
    if (!areaCode) {
      toast({
        title: "Invalid area code",
        description: "Could not extract area code from phone number.",
        variant: "destructive",
      });
      return;
    }

    setIsPurchasing(true);

    try {
      console.log('[PhoneSetup] Calling purchase-phone-number with:', { businessPhoneNumber: businessPhone, areaCode });

      // Call Edge Function to purchase number and save business phone
      const { data, error } = await supabase.functions.invoke("purchase-phone-number", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          businessPhoneNumber: businessPhone,
          areaCode,
        },
      });

      console.log('[PhoneSetup] Response:', { data, error });

      if (error) {
        console.error('[PhoneSetup] Edge function error:', error);
        throw new Error(error.message || "Failed to call phone setup function");
      }

      if (!data?.success) {
        console.error('[PhoneSetup] Setup failed:', data);
        throw new Error(data?.error || "Failed to set up phone number");
      }

      console.log('[PhoneSetup] Phone number set up successfully:', data.phoneNumber);
      setFoundNumber(data.phoneNumber);

      toast({
        title: "Phone number activated!",
        description: `Your new number ${formatPhoneDisplay(data.phoneNumber)} is ready.`,
      });

      // Wait a moment to show the success message, then navigate to next step
      setTimeout(() => {
        navigate("/onboarding/setup");
      }, 1500);
    } catch (error: any) {
      console.error("Purchase error:", error);
      toast({
        title: "Setup failed",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsPurchasing(false);
    }
  };

  // If already has phone, show success and redirect
  if (existingPhone) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md mx-auto px-4"
        >
          <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-success" />
          </div>
          <h2 className="font-display text-2xl font-bold mb-2">Phone Already Set Up</h2>
          <p className="text-muted-foreground mb-4">
            Your number {formatPhoneDisplay(existingPhone.phone_number)} is ready.
          </p>
          <Button onClick={() => navigate("/onboarding/setup")}>
            Continue
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </motion.div>
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
              <p className="text-sm text-muted-foreground">Step 3 of 6 • Enter your business phone</p>
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
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Phone className="w-8 h-8 text-primary" />
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold mb-3">
            Enter Your Business Phone Number
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            We'll find you a new AI-powered phone number in the same area code and forward your existing number to it.
          </p>
        </motion.div>

        {/* Phone Input */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card border rounded-xl p-6 mb-6"
        >
          <div className="space-y-4">
            <div>
              <Label htmlFor="business-phone" className="text-base font-medium">
                Your Current Business Phone Number
              </Label>
              <p className="text-sm text-muted-foreground mt-1 mb-3">
                Enter your existing business phone number (US only)
              </p>
              <Input
                id="business-phone"
                type="tel"
                placeholder="+1 (555) 123-4567"
                value={businessPhone}
                onChange={(e) => handleBusinessPhoneChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && isValidPhoneNumber(businessPhone) && !isPurchasing && !foundNumber && !authLoading) {
                    e.preventDefault();
                    handlePurchase();
                  }
                }}
                className="text-lg h-12"
                disabled={isPurchasing}
              />
            </div>

            {businessPhone && isValidPhoneNumber(businessPhone) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="bg-success/10 border border-success/20 rounded-lg p-4"
              >
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-success text-sm">Valid phone number</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      We'll find a number with area code {extractAreaCode(businessPhone)}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {businessPhone && !isValidPhoneNumber(businessPhone) && businessPhone.replace(/\D/g, "").length >= 10 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="bg-destructive/10 border border-destructive/20 rounded-lg p-4"
              >
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-destructive text-sm">Invalid phone number</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Please enter a valid 10-digit US phone number
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-info/10 border border-info/20 rounded-lg p-4 mb-6"
        >
          <h4 className="font-medium text-sm mb-2">How it works</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-info mt-0.5">•</span>
              <span>We'll get you a new phone number in your area code</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-info mt-0.5">•</span>
              <span>Your AI agent will answer calls to this new number 24/7</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-info mt-0.5">•</span>
              <span>Keep your existing number - just forward calls when you're unavailable</span>
            </li>
          </ul>
        </motion.div>

        {/* Success Message */}
        {foundNumber && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-success/10 border-2 border-success rounded-xl p-6 mb-6 text-center"
          >
            <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-3" />
            <h3 className="font-display text-xl font-bold mb-2">Number Activated!</h3>
            <p className="text-muted-foreground mb-1">Your new AI-powered number:</p>
            <p className="text-2xl font-bold text-success">{formatPhoneDisplay(foundNumber)}</p>
          </motion.div>
        )}

        {/* Continue Button */}
        <Button
          size="lg"
          className="w-full"
          onClick={handlePurchase}
          disabled={!isValidPhoneNumber(businessPhone) || isPurchasing || !!foundNumber || authLoading}
        >
          {isPurchasing ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Setting up your number...
            </>
          ) : foundNumber ? (
            <>
              <CheckCircle2 className="w-5 h-5 mr-2" />
              Redirecting...
            </>
          ) : (
            <>
              Continue
              <ArrowRight className="w-5 h-5 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
