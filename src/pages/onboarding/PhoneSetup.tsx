import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { 
  Phone, 
  Loader2, 
  ArrowRight, 
  Sparkles, 
  MapPin, 
  Globe,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";

type NumberType = "local" | "toll-free";

interface AvailableNumber {
  phone_number: string;
  friendly_name: string;
  locality?: string;
  region?: string;
}

export default function PhoneSetup() {
  const [numberType, setNumberType] = useState<NumberType>("local");
  const [areaCode, setAreaCode] = useState("");
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [availableNumbers, setAvailableNumbers] = useState<AvailableNumber[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  
  const navigate = useNavigate();
  const { toast } = useToast();
  const { session, user } = useAuth();

  // Check onboarding status
  const { data: organization } = useQuery({
    queryKey: ["organization-onboarding", user?.organization_id],
    queryFn: async () => {
      if (!user?.organization_id) return null;
      const { data } = await supabase
        .from("organizations")
        .select("*, phone_numbers(*)")
        .eq("id", user.organization_id)
        .single();
      return data;
    },
    enabled: !!user?.organization_id,
  });

  // If they already have a phone, skip
  const existingPhone = organization?.phone_numbers?.[0];

  const searchNumbers = async () => {
    if (!session) return;

    setIsSearching(true);
    setSearchError(null);
    setAvailableNumbers([]);

    try {
      const { data, error } = await supabase.functions.invoke("search-phone-numbers", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          numberType,
          areaCode: numberType === "local" ? areaCode : undefined,
        },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || "Failed to search numbers");
      }

      setAvailableNumbers(data.numbers || []);
      
      if (data.numbers?.length === 0) {
        setSearchError(
          numberType === "local" && areaCode
            ? `No numbers available in area code ${areaCode}. Try a different area code.`
            : "No numbers available. Please try again."
        );
      }
    } catch (error: any) {
      console.error("Search error:", error);
      setSearchError(error.message || "Failed to search for numbers");
    } finally {
      setIsSearching(false);
    }
  };

  const purchaseNumber = async () => {
    if (!session || !selectedNumber) return;

    setIsPurchasing(true);

    try {
      const { data, error } = await supabase.functions.invoke("purchase-phone-number", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          phoneNumber: selectedNumber,
          numberType,
        },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || "Failed to purchase number");
      }

      toast({
        title: "Phone number activated!",
        description: `Your new number ${selectedNumber} is ready to use.`,
      });

      // Navigate to dashboard
      navigate("/dashboard?onboarding=complete");
    } catch (error: any) {
      console.error("Purchase error:", error);
      toast({
        title: "Purchase failed",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsPurchasing(false);
    }
  };

  const formatPhoneNumber = (phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 11 && cleaned.startsWith("1")) {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
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
            Your number {formatPhoneNumber(existingPhone.phone_number)} is ready.
          </p>
          <Button onClick={() => navigate("/dashboard")}>
            Go to Dashboard
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
              <h1 className="font-display font-semibold text-lg">AnswerAfter</h1>
              <p className="text-sm text-muted-foreground">Step 3 of 3 • Choose your phone number</p>
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
            Choose your business number
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            This is the number your customers will call. Our AI will answer 24/7.
          </p>
        </motion.div>

        {/* Number Type Selection */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card border rounded-xl p-6 mb-6"
        >
          <Label className="text-base font-semibold mb-4 block">Number Type</Label>
          <RadioGroup
            value={numberType}
            onValueChange={(v) => {
              setNumberType(v as NumberType);
              setAvailableNumbers([]);
              setSelectedNumber(null);
            }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-4"
          >
            <label
              htmlFor="local"
              className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                numberType === "local"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <RadioGroupItem value="local" id="local" className="mt-1" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <MapPin className="w-4 h-4 text-primary" />
                  <span className="font-semibold">Local Number</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  A number with your area code. Customers see a familiar local number.
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Included in your plan
                </p>
              </div>
            </label>

            <label
              htmlFor="toll-free"
              className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                numberType === "toll-free"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <RadioGroupItem value="toll-free" id="toll-free" className="mt-1" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Globe className="w-4 h-4 text-primary" />
                  <span className="font-semibold">Toll-Free Number</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  800, 888, 877, etc. Nationwide presence, free for callers.
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  +$5/mo additional
                </p>
              </div>
            </label>
          </RadioGroup>
        </motion.div>

        {/* Area Code Input (for local) */}
        {numberType === "local" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-card border rounded-xl p-6 mb-6"
          >
            <Label htmlFor="areaCode" className="text-base font-semibold mb-2 block">
              Preferred Area Code (Optional)
            </Label>
            <p className="text-sm text-muted-foreground mb-4">
              Enter your local area code to find numbers in your area.
            </p>
            <div className="flex gap-3">
              <Input
                id="areaCode"
                type="text"
                placeholder="e.g. 415"
                maxLength={3}
                value={areaCode}
                onChange={(e) => setAreaCode(e.target.value.replace(/\D/g, ""))}
                className="w-32"
              />
              <Button onClick={searchNumbers} disabled={isSearching}>
                {isSearching ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Searching...
                  </>
                ) : (
                  "Search Numbers"
                )}
              </Button>
            </div>
          </motion.div>
        )}

        {/* Toll-free search button */}
        {numberType === "toll-free" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-6"
          >
            <Button onClick={searchNumbers} disabled={isSearching} className="w-full">
              {isSearching ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Searching toll-free numbers...
                </>
              ) : (
                "Find Available Toll-Free Numbers"
              )}
            </Button>
          </motion.div>
        )}

        {/* Search Error */}
        {searchError && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 text-destructive mb-6"
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{searchError}</span>
          </motion.div>
        )}

        {/* Available Numbers */}
        {availableNumbers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card border rounded-xl p-6 mb-6"
          >
            <Label className="text-base font-semibold mb-4 block">
              Select Your Number
            </Label>
            <div className="space-y-2">
              {availableNumbers.map((num) => (
                <label
                  key={num.phone_number}
                  className={`flex items-center justify-between p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedNumber === num.phone_number
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="phoneNumber"
                      value={num.phone_number}
                      checked={selectedNumber === num.phone_number}
                      onChange={() => setSelectedNumber(num.phone_number)}
                      className="sr-only"
                    />
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        selectedNumber === num.phone_number
                          ? "border-primary bg-primary"
                          : "border-muted-foreground/30"
                      }`}
                    >
                      {selectedNumber === num.phone_number && (
                        <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                      )}
                    </div>
                    <span className="font-mono font-semibold text-lg">
                      {formatPhoneNumber(num.phone_number)}
                    </span>
                  </div>
                  {num.locality && (
                    <span className="text-sm text-muted-foreground">
                      {num.locality}, {num.region}
                    </span>
                  )}
                </label>
              ))}
            </div>
          </motion.div>
        )}

        {/* Purchase Button */}
        {selectedNumber && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Button
              onClick={purchaseNumber}
              disabled={isPurchasing}
              size="lg"
              className="w-full"
            >
              {isPurchasing ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Activating your number...
                </>
              ) : (
                <>
                  Activate {formatPhoneNumber(selectedNumber)}
                  <ArrowRight className="w-5 h-5 ml-2" />
                </>
              )}
            </Button>
            <p className="text-center text-sm text-muted-foreground mt-3">
              Your AI agent will start answering calls immediately.
            </p>
          </motion.div>
        )}

        {/* Skip option */}
        <div className="mt-8 text-center">
          <button
            onClick={() => navigate("/dashboard")}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip for now — I'll set this up later
          </button>
        </div>
      </div>
    </div>
  );
}
