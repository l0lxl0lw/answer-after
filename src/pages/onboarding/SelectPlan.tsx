import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Check, Loader2, ArrowRight, Sparkles } from "lucide-react";
import { useSubscriptionTiers } from "@/hooks/use-api";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { shouldSkipStripe } from "@/lib/environment";
import { LINKS, COMPANY } from "@/lib/constants";

export default function SelectPlan() {
  const { data: tiers, isLoading: isLoadingTiers } = useSubscriptionTiers();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { session } = useAuth();

  const formatPrice = (priceCents: number) => {
    if (priceCents < 0) return "Custom";
    return Math.floor(priceCents / 100);
  };

  const isEnterprise = (planId: string) => planId === "enterprise";

  const handleSelectPlan = async (planId: string) => {
    if (isEnterprise(planId)) {
      window.location.href = LINKS.salesEmail;
      return;
    }

    if (!session) {
      toast({
        title: "Session expired",
        description: "Please log in again.",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    setSelectedPlan(planId);
    setIsProcessing(true);

    // Skip Stripe in local/development environment
    if (shouldSkipStripe()) {
      toast({
        title: "Development Mode",
        description: "Skipping Stripe checkout in local environment. Proceeding to next step.",
      });
      setTimeout(() => {
        navigate("/onboarding/phone");
      }, 1000);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("create-checkout-with-trial", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          planId,
        },
      });

      if (error || !data?.url) {
        throw new Error(error?.message || "Failed to create checkout session");
      }

      window.location.href = data.url;
    } catch (error: any) {
      console.error("Checkout error:", error);
      toast({
        title: "Checkout failed",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
      setSelectedPlan(null);
      setIsProcessing(false);
    }
  };

  // Filter out enterprise for now during onboarding
  const availableTiers = tiers?.filter((t) => !isEnterprise(t.plan_id)) || [];

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
              <p className="text-sm text-muted-foreground">Step 1 of 6 • Choose your plan</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Intro */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h2 className="font-display text-2xl sm:text-3xl font-bold mb-3">
            Choose your plan
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            All plans include AI call answering, appointment booking, and SMS. Upgrade or downgrade anytime.
          </p>
          
          {/* First month promo */}
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 text-accent font-semibold text-sm">
            🎉 Your first month is only $1 on any plan
          </div>
        </motion.div>

        {/* Loading State */}
        {isLoadingTiers && (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {/* Plan Cards */}
        {!isLoadingTiers && availableTiers.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {availableTiers.map((tier, index) => (
              <motion.div
                key={tier.plan_id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.08 }}
                className="relative flex flex-col"
              >
                <div
                  className={`flex-1 flex flex-col rounded-2xl p-5 transition-all cursor-pointer ${
                    tier.is_popular
                      ? "bg-primary text-primary-foreground ring-2 ring-primary shadow-lg"
                      : "bg-card border border-border hover:border-primary/50"
                  } ${
                    selectedPlan === tier.plan_id ? "ring-2 ring-accent" : ""
                  }`}
                  onClick={() => !isProcessing && handleSelectPlan(tier.plan_id)}
                >
                  {/* Popular Badge */}
                  {tier.is_popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="inline-block px-3 py-1 rounded-full bg-accent text-accent-foreground text-xs font-semibold">
                        Most Popular
                      </span>
                    </div>
                  )}

                  {/* Plan Header */}
                  <div className="mb-4 mt-2">
                    <h3
                      className={`font-display font-semibold text-lg mb-1 ${
                        tier.is_popular ? "text-primary-foreground" : "text-foreground"
                      }`}
                    >
                      {tier.name}
                    </h3>
                    <p
                      className={`text-sm ${
                        tier.is_popular ? "text-primary-foreground/80" : "text-muted-foreground"
                      }`}
                    >
                      {tier.description}
                    </p>
                  </div>

                  {/* Price */}
                  <div className="mb-5">
                    <div className="flex items-baseline gap-1">
                      <span
                        className={`font-display text-3xl font-bold ${
                          tier.is_popular ? "text-primary-foreground" : "text-foreground"
                        }`}
                      >
                        ${formatPrice(tier.price_cents)}
                      </span>
                      <span
                        className={`text-sm ${
                          tier.is_popular ? "text-primary-foreground/70" : "text-muted-foreground"
                        }`}
                      >
                        /mo
                      </span>
                    </div>
                    <p
                      className={`text-xs mt-1 ${
                        tier.is_popular ? "text-primary-foreground/70" : "text-muted-foreground"
                      }`}
                    >
                      billed monthly
                    </p>
                  </div>

                  {/* Credits */}
                  <div
                    className={`mb-4 p-3 rounded-lg ${
                      tier.is_popular ? "bg-primary-foreground/10" : "bg-muted"
                    }`}
                  >
                    <div
                      className={`text-lg font-semibold ${
                        tier.is_popular ? "text-primary-foreground" : "text-foreground"
                      }`}
                    >
                      {tier.credits.toLocaleString()} credits/mo
                    </div>
                    <div
                      className={`text-xs ${
                        tier.is_popular ? "text-primary-foreground/70" : "text-muted-foreground"
                      }`}
                    >
                      ~{Math.round(tier.credits / 3)} calls per month
                    </div>
                  </div>

                  {/* Features */}
                  <ul className="space-y-2 mb-5 flex-1">
                    {tier.features.slice(0, 4).map((feature: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2">
                        <div
                          className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                            tier.is_popular ? "bg-primary-foreground/20" : "bg-success/10"
                          }`}
                        >
                          <Check
                            className={`w-2.5 h-2.5 ${
                              tier.is_popular ? "text-primary-foreground" : "text-success"
                            }`}
                          />
                        </div>
                        <span
                          className={`text-sm ${
                            tier.is_popular ? "text-primary-foreground/90" : "text-foreground"
                          }`}
                        >
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <Button
                    variant={tier.is_popular ? "secondary" : "default"}
                    size="sm"
                    className={`w-full ${
                      tier.is_popular
                        ? "bg-primary-foreground text-primary hover:bg-primary-foreground/90"
                        : ""
                    }`}
                    disabled={isProcessing}
                  >
                    {isProcessing && selectedPlan === tier.plan_id ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        Select {tier.name}
                        <ArrowRight className="w-4 h-4 ml-1" />
                      </>
                    )}
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Enterprise Note */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-8 text-center"
        >
          <p className="text-muted-foreground text-sm">
            Need more? <a href={LINKS.salesEmail} className="text-primary hover:underline">Contact sales</a> for enterprise pricing with custom limits and dedicated support.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
