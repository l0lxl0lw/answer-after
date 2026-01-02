import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, Sparkles, Plus, Trash2, Loader2, Wrench, Zap, Phone, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentSubscriptionTier } from "@/hooks/use-api";
import { useQuery } from "@tanstack/react-query";
import { COMPANY } from "@/lib/constants";
import { extractAreaCode, formatPhoneDisplay } from "@/lib/phoneUtils";

// Feature gating now uses DB flags from subscription_tiers table:
// - has_custom_agent: Controls access to greeting/service customization (Growth+)
// - has_custom_ai_training: Controls access to custom instructions (Pro+)
import { createLogger } from "@/lib/logger";

const log = createLogger('SetupServices');

interface Service {
  id: string;
  name: string;
  price: string;
  duration: string;
}

export default function SetupServices() {
  const [greeting, setGreeting] = useState("");
  const [services, setServices] = useState<Service[]>([
    { id: "1", name: "", price: "", duration: "" },
  ]);
  const [context, setContext] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingAgent, setIsCreatingAgent] = useState(false);

  // Phone purchase state
  const [isPurchasingPhone, setIsPurchasingPhone] = useState(false);
  const [phonePurchaseError, setPhonePurchaseError] = useState<string | null>(null);
  const phonePurchaseAttempted = useRef(false);

  const navigate = useNavigate();
  const { toast } = useToast();
  const { session, user } = useAuth();

  // Use the new hook that provides tier data with feature flags
  const { currentPlanId, currentTier, features, isLoading: isLoadingPlan } = useCurrentSubscriptionTier();

  log.debug('Current plan from database:', currentPlanId, 'Tier:', currentTier?.name);

  // Check for existing phone number
  const { data: existingPhone, isLoading: isLoadingPhone, refetch: refetchPhone } = useQuery({
    queryKey: ["existing-phone", user?.organization_id],
    queryFn: async () => {
      if (!user?.organization_id) return null;
      const { data } = await supabase
        .from("phone_numbers")
        .select("phone_number")
        .eq("organization_id", user.organization_id)
        .eq("is_active", true)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.organization_id,
  });

  // Get business phone from organization for area code
  const { data: orgData, isLoading: isLoadingOrg } = useQuery({
    queryKey: ["org-business-phone", user?.organization_id],
    queryFn: async () => {
      if (!user?.organization_id) return null;
      const { data } = await supabase
        .from("organizations")
        .select("business_phone_number")
        .eq("id", user.organization_id)
        .single();
      return data;
    },
    enabled: !!user?.organization_id,
  });

  // Plan capabilities - now using DB feature flags instead of hardcoded plan names
  // has_custom_agent = true for Growth, Pro, Business (enables greeting & service customization)
  // has_custom_ai_training = true for Pro, Business (enables custom instructions)
  const hasGreetingSetup = features.hasCustomAgent;
  const hasServiceSetup = features.hasCustomAgent;
  const hasContextSetup = features.hasCustomAiTraining;

  // Core plan (no custom agent): Auto-create agent with defaults and skip
  // Using feature flag instead of hardcoded plan name check
  useEffect(() => {
    if (!isLoadingPlan && !features.hasCustomAgent && user?.organization_id && session) {
      log.debug('Plan without custom agent detected, auto-creating default agent');
      handleCoreAutoSetup();
    }
  }, [isLoadingPlan, features.hasCustomAgent, user?.organization_id, session]);

  // Load existing data for plans with custom agent capability
  useEffect(() => {
    if (features.hasCustomAgent) {
      loadExistingData();
    }
  }, [user?.organization_id, features.hasCustomAgent]);

  // Auto-purchase phone number if not already done
  useEffect(() => {
    const purchasePhone = async () => {
      // Skip if already have phone, still loading, or already attempted
      if (existingPhone || isLoadingPhone || isLoadingOrg || isPurchasingPhone || phonePurchaseAttempted.current) return;
      // Skip if no organization data or no business phone
      if (!orgData?.business_phone_number || !session) return;

      phonePurchaseAttempted.current = true;
      const businessPhone = orgData.business_phone_number;
      const areaCode = extractAreaCode(businessPhone);

      if (!areaCode) {
        setPhonePurchaseError("Could not extract area code from your business phone number.");
        return;
      }

      setIsPurchasingPhone(true);
      setPhonePurchaseError(null);

      try {
        log.debug('Auto-purchasing phone number with area code:', areaCode);

        const { data, error } = await supabase.functions.invoke("purchase-phone-number", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: {
            businessPhoneNumber: businessPhone,
            areaCode,
          },
        });

        if (error || !data?.success) {
          throw new Error(data?.error || error?.message || "Failed to purchase phone number");
        }

        log.debug('Phone number purchased successfully:', data.phoneNumber);

        toast({
          title: "Phone number activated!",
          description: `Your new number ${formatPhoneDisplay(data.phoneNumber)} is ready.`,
        });

        // Refetch to update the existingPhone state
        refetchPhone();
      } catch (error: any) {
        log.error("Phone purchase error:", error);
        setPhonePurchaseError(error.message || "Failed to set up phone number. Please try again.");
      } finally {
        setIsPurchasingPhone(false);
      }
    };

    purchasePhone();
  }, [existingPhone, isLoadingPhone, isLoadingOrg, orgData, session]);

  const loadExistingData = async () => {
    if (!user?.organization_id) return;

    try {
      // Load services
      const { data: servicesData } = await supabase
        .from("services")
        .select("*")
        .eq("organization_id", user.organization_id);

      if (servicesData && servicesData.length > 0) {
        setServices(
          servicesData.map((s) => ({
            id: s.id,
            name: s.name,
            price: s.price_cents ? String(s.price_cents / 100) : "",
            duration: s.duration_minutes ? String(s.duration_minutes) : "",
          }))
        );
      }

      // Load agent context
      const { data: agentData } = await supabase
        .from("organization_agents")
        .select("context")
        .eq("organization_id", user.organization_id)
        .maybeSingle();

      if (agentData?.context) {
        try {
          const parsedContext = JSON.parse(agentData.context);
          setGreeting(parsedContext.greeting || "");
          setContext(parsedContext.customInstructions || "");
        } catch {
          // Invalid JSON, ignore
        }
      }
    } catch (error) {
      log.error("Error loading data:", error);
    }
  };

  const handleCoreAutoSetup = async () => {
    if (!session || !user?.organization_id) return;

    setIsCreatingAgent(true);

    try {
      // Create ElevenLabs agent with defaults
      const { data, error } = await supabase.functions.invoke("elevenlabs-agent", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          action: "create-agent",
          organizationId: user.organization_id,
        },
      });

      if (error) {
        log.error('Error creating agent:', error);
        throw error;
      }

      log.debug('Default agent created for Core plan');

      toast({
        title: "Agent ready!",
        description: "Your AI receptionist is set up with default settings.",
      });

      // Navigate to test call
      setTimeout(() => {
        navigate("/onboarding/test-call");
      }, 1000);
    } catch (error: any) {
      log.error("Auto-setup error:", error);
      toast({
        title: "Setup issue",
        description: "We'll continue with default settings. You can customize later.",
      });
      // Still navigate even if agent creation fails
      setTimeout(() => {
        navigate("/onboarding/test-call");
      }, 1500);
    } finally {
      setIsCreatingAgent(false);
    }
  };

  const addService = () => {
    setServices([
      ...services,
      { id: Date.now().toString(), name: "", price: "", duration: "" },
    ]);
  };

  const removeService = (id: string) => {
    if (services.length === 1) {
      // Just clear the service instead of removing
      setServices([{ id: "1", name: "", price: "", duration: "" }]);
      return;
    }
    setServices(services.filter((s) => s.id !== id));
  };

  const updateService = (id: string, field: keyof Service, value: string) => {
    setServices(
      services.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const handleContinue = async () => {
    if (!session || !user?.organization_id) {
      toast({
        title: "Error",
        description: "Session expired. Please log in again.",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    setIsSaving(true);

    try {
      // Save services if plan allows
      if (hasServiceSetup) {
        const validServices = services.filter((s) => s.name.trim() !== "");

        if (validServices.length > 0) {
          // Delete existing services first
          await supabase
            .from("services")
            .delete()
            .eq("organization_id", user.organization_id);

          // Insert new services
          const servicesToInsert = validServices.map((s) => ({
            organization_id: user.organization_id,
            name: s.name.trim(),
            price_cents: s.price ? Math.round(parseFloat(s.price) * 100) : 0,
            duration_minutes: s.duration ? parseInt(s.duration) : 60,
            is_active: true,
          }));

          const { error: servicesError } = await supabase
            .from("services")
            .insert(servicesToInsert);

          if (servicesError) {
            log.error('Error saving services:', servicesError);
          }
        }
      }

      // Build agent context based on plan
      const agentContext: Record<string, any> = {};

      if (hasGreetingSetup && greeting.trim()) {
        agentContext.greeting = greeting.trim();
      }

      if (hasServiceSetup) {
        const validServices = services.filter((s) => s.name.trim() !== "");
        if (validServices.length > 0) {
          agentContext.services = validServices.map((s) => ({
            name: s.name,
            price: s.price ? `$${s.price}` : "Quote on request",
            duration: s.duration ? `${s.duration} minutes` : "Varies",
          }));
        }
      }

      if (hasContextSetup && context.trim()) {
        agentContext.customInstructions = context.trim();
      }

      // Check if agent record exists
      const { data: existingAgent } = await supabase
        .from("organization_agents")
        .select("id, elevenlabs_agent_id")
        .eq("organization_id", user.organization_id)
        .maybeSingle();

      if (existingAgent) {
        // Update existing agent context
        await supabase
          .from("organization_agents")
          .update({
            context: JSON.stringify(agentContext),
            updated_at: new Date().toISOString(),
          })
          .eq("organization_id", user.organization_id);
      }

      // Create or update ElevenLabs agent
      const action = existingAgent?.elevenlabs_agent_id ? "update-agent" : "create-agent";

      log.debug(`${action} for plan:`, currentPlanId);

      const { error: agentError } = await supabase.functions.invoke("elevenlabs-agent", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          action,
          organizationId: user.organization_id,
          context: JSON.stringify(agentContext),
          greeting: agentContext.greeting,
        },
      });

      if (agentError) {
        log.error('Agent creation/update error:', agentError);
        // Don't throw - continue anyway
      }

      toast({
        title: "Settings saved!",
        description: "Your AI agent has been configured.",
      });

      // Navigate to test call step
      navigate("/onboarding/test-call");
    } catch (error: any) {
      log.error("Save error:", error);
      toast({
        title: "Save failed",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Loading state (including org data for phone purchase)
  if (isLoadingPlan || isLoadingPhone || isLoadingOrg) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Phone purchase in progress
  if (isPurchasingPhone) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md mx-auto px-4"
        >
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Phone className="w-8 h-8 text-primary" />
          </div>
          <h2 className="font-display text-2xl font-bold mb-2">Setting Up Your Phone Number</h2>
          <p className="text-muted-foreground mb-4">
            We're activating your dedicated business line. This only takes a moment.
          </p>
          <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
        </motion.div>
      </div>
    );
  }

  // Phone purchase error
  if (phonePurchaseError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md mx-auto px-4"
        >
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="font-display text-2xl font-bold mb-2">Phone Setup Issue</h2>
          <p className="text-muted-foreground mb-6">{phonePurchaseError}</p>
          <div className="flex flex-col gap-3">
            <Button
              onClick={() => {
                phonePurchaseAttempted.current = false;
                setPhonePurchaseError(null);
              }}
            >
              Try Again
            </Button>
            <Button
              variant="outline"
              onClick={() => setPhonePurchaseError(null)}
            >
              Continue Without Phone
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Plans without custom agent capability: Show auto-setup message
  if (!features.hasCustomAgent) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md mx-auto px-4"
        >
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Zap className="w-8 h-8 text-primary" />
          </div>
          <h2 className="font-display text-2xl font-bold mb-2">Setting Up Your Agent</h2>
          <p className="text-muted-foreground mb-4">
            We're configuring your AI receptionist with smart defaults. This only takes a moment.
          </p>
          {isCreatingAgent && (
            <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
          )}
          <p className="text-sm text-muted-foreground mt-4">
            Want more customization? <a href="/dashboard/subscriptions" className="text-primary hover:underline">Upgrade your plan</a>
          </p>
        </motion.div>
      </div>
    );
  }

  // Plans with custom agent capability: Show form
  const stepNumber = '3'; // Step 3 of 5 (phone setup is now automatic)
  const stepTotal = '5';

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
              <p className="text-sm text-muted-foreground">Step {stepNumber} of {stepTotal} • Configure your AI agent</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Intro */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Wrench className="w-8 h-8 text-primary" />
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold mb-3">
            Customize Your AI Agent
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            {hasContextSetup
              ? "Personalize how your AI agent greets callers, describe your services, and add custom instructions."
              : "Set up your greeting and add the services you offer."}
          </p>
        </motion.div>

        {/* Greeting Section - Growth, Pro, Business */}
        {hasGreetingSetup && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card border rounded-xl p-6 mb-6"
          >
            <div className="mb-3">
              <Label htmlFor="greeting" className="text-base font-semibold">
                Custom Greeting
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                How should your AI agent greet callers? Leave blank for a default greeting.
              </p>
            </div>

            <Textarea
              id="greeting"
              placeholder="e.g., Hi! Thanks for calling Smile Dental Care. This is Sarah, how can I help you today?"
              value={greeting}
              onChange={(e) => setGreeting(e.target.value)}
              className="min-h-[80px]"
            />
          </motion.div>
        )}

        {/* Services Section - Growth, Pro, Business */}
        {hasServiceSetup && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-card border rounded-xl p-6 mb-6"
          >
            <h3 className="font-semibold text-lg mb-1">Your Services</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Add the services you offer so your AI can accurately assist customers.
            </p>

            <div className="space-y-4">
              {services.map((service, index) => (
                <motion.div
                  key={service.id}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-muted-foreground">
                      Service {index + 1}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeService(service.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-1">
                      <Label htmlFor={`service-name-${service.id}`}>Service Name</Label>
                      <Input
                        id={`service-name-${service.id}`}
                        placeholder="e.g., Dental Checkup"
                        value={service.name}
                        onChange={(e) =>
                          updateService(service.id, "name", e.target.value)
                        }
                      />
                    </div>

                    <div>
                      <Label htmlFor={`service-price-${service.id}`}>
                        Price (optional)
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                          $
                        </span>
                        <Input
                          id={`service-price-${service.id}`}
                          type="number"
                          placeholder="99"
                          value={service.price}
                          onChange={(e) =>
                            updateService(service.id, "price", e.target.value)
                          }
                          className="pl-6"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor={`service-duration-${service.id}`}>
                        Duration (min)
                      </Label>
                      <Input
                        id={`service-duration-${service.id}`}
                        type="number"
                        placeholder="60"
                        value={service.duration}
                        onChange={(e) =>
                          updateService(service.id, "duration", e.target.value)
                        }
                      />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={addService}
              className="mt-4 w-full"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Another Service
            </Button>
          </motion.div>
        )}

        {/* Context Section - Pro, Business only */}
        {hasContextSetup && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-card border rounded-xl p-6 mb-6"
          >
            <div className="mb-3">
              <Label htmlFor="context" className="text-base font-semibold">
                Custom Instructions
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Tell your AI agent about your business, special policies, or how to handle specific situations.
              </p>
            </div>

            <Textarea
              id="context"
              placeholder="e.g., We're a family-owned dental practice serving the greater Portland area. We offer same-day emergency appointments. Always mention our new patient special and flexible financing options."
              value={context}
              onChange={(e) => setContext(e.target.value)}
              className="min-h-[120px]"
            />
          </motion.div>
        )}

        {/* Info Box */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-info/10 border border-info/20 rounded-lg p-4 mb-6"
        >
          <p className="text-sm text-muted-foreground">
            💡 <strong>Tip:</strong> You can update these settings anytime from the "My Agent" page in your dashboard.
          </p>
        </motion.div>

        {/* Continue Button */}
        <Button
          size="lg"
          className="w-full"
          onClick={handleContinue}
          disabled={isSaving}
        >
          {isSaving ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Saving...
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
