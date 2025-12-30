import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, Sparkles, Plus, Trash2, Loader2, Wrench } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { COMPANY } from "@/lib/constants";

interface Service {
  id: string;
  name: string;
  price: string;
  duration: string;
}

export default function SetupServices() {
  const [services, setServices] = useState<Service[]>([
    { id: "1", name: "", price: "", duration: "" },
  ]);
  const [context, setContext] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const navigate = useNavigate();
  const { toast } = useToast();
  const { session, user } = useAuth();

  // Load existing services and context if any
  useEffect(() => {
    loadExistingData();
  }, [user?.organization_id]);

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
            price: s.base_price_cents ? String(s.base_price_cents / 100) : "",
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
          setContext(parsedContext.customInstructions || "");
        } catch {
          // Invalid JSON, ignore
        }
      }
    } catch (error) {
      console.error("Error loading data:", error);
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
      toast({
        title: "Cannot remove",
        description: "You must have at least one service.",
        variant: "destructive",
      });
      return;
    }
    setServices(services.filter((s) => s.id !== id));
  };

  const updateService = (id: string, field: keyof Service, value: string) => {
    setServices(
      services.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const validateServices = (): boolean => {
    // At least one service with a name is required
    const validServices = services.filter((s) => s.name.trim() !== "");
    if (validServices.length === 0) {
      toast({
        title: "Service required",
        description: "Please add at least one service with a name.",
        variant: "destructive",
      });
      return false;
    }
    return true;
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

    if (!validateServices()) {
      return;
    }

    setIsSaving(true);

    try {
      // Save services
      const validServices = services.filter((s) => s.name.trim() !== "");

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
        throw new Error(`Failed to save services: ${servicesError.message}`);
      }

      // Update agent context
      const { data: agentData } = await supabase
        .from("organization_agents")
        .select("context")
        .eq("organization_id", user.organization_id)
        .single();

      let updatedContext = {};
      if (agentData?.context) {
        try {
          updatedContext = JSON.parse(agentData.context);
        } catch {
          updatedContext = {};
        }
      }

      // Add services and custom instructions to context
      updatedContext = {
        ...updatedContext,
        services: validServices.map((s) => ({
          name: s.name,
          price: s.price ? `$${s.price}` : "Quote on request",
          duration: s.duration ? `${s.duration} minutes` : "Varies",
        })),
        customInstructions: context.trim(),
      };

      const { error: contextError } = await supabase
        .from("organization_agents")
        .update({
          context: JSON.stringify(updatedContext),
          updated_at: new Date().toISOString(),
        })
        .eq("organization_id", user.organization_id);

      if (contextError) {
        throw new Error(`Failed to update context: ${contextError.message}`);
      }

      // Update the ElevenLabs agent with new context
      await supabase.functions.invoke("elevenlabs-agent", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          action: "update-agent",
          organizationId: user.organization_id,
          context: JSON.stringify(updatedContext),
        },
      });

      toast({
        title: "Services saved!",
        description: "Your AI agent has been updated with your services.",
      });

      // Navigate to test call step
      navigate("/onboarding/test-call");
    } catch (error: any) {
      console.error("Save error:", error);
      toast({
        title: "Save failed",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

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
              <p className="text-sm text-muted-foreground">Step 4 of 6 • Configure your services</p>
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
            Tell Us About Your Services
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Add the services you offer so your AI agent can accurately assist customers. You can always change these later.
          </p>
        </motion.div>

        {/* Services Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card border rounded-xl p-6 mb-6"
        >
          <h3 className="font-semibold text-lg mb-4">Your Services</h3>

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
                  {services.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeService(service.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-1">
                    <Label htmlFor={`service-name-${service.id}`}>Service Name</Label>
                    <Input
                      id={`service-name-${service.id}`}
                      placeholder="e.g., Plumbing Repair"
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

        {/* Context Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card border rounded-xl p-6 mb-6"
        >
          <div className="mb-3">
            <Label htmlFor="context" className="text-base font-semibold">
              Additional Instructions (optional)
            </Label>
            <p className="text-sm text-muted-foreground mt-1">
              Tell your AI agent about your business, special policies, or how to handle specific situations.
            </p>
          </div>

          <Textarea
            id="context"
            placeholder="e.g., We're a family-owned plumbing business serving the greater Portland area. We offer 24/7 emergency service with a 1-hour response time. Always mention our senior citizen discount."
            value={context}
            onChange={(e) => setContext(e.target.value)}
            className="min-h-[120px]"
          />
        </motion.div>

        {/* Info Box */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-info/10 border border-info/20 rounded-lg p-4 mb-6"
        >
          <p className="text-sm text-muted-foreground">
            💡 <strong>Tip:</strong> You can update your services and agent instructions anytime from the "My Agent" page in your dashboard.
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
