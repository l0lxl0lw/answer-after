import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Zap, Check, Loader2 } from "lucide-react";
import { COMPANY } from "@/lib/constants";
import { useAuth } from "@/contexts/AuthContext";
import { createLogger } from "@/lib/logger";
import { useSubscriptionTiers } from "@/hooks/use-api";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

// This page shows BEFORE Stripe checkout to offer upgrade options
// User arrives here after selecting a plan on SelectPlan page
// Business plan users skip this page (handled in SelectPlan)

const log = createLogger('UpgradePrompt');

// Plan hierarchy for determining upgrades
const PLAN_HIERARCHY = ['core', 'growth', 'pro', 'business'];

export default function UpgradePrompt() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session } = useAuth();
  const { toast } = useToast();
  const { data: tiers, isLoading: isLoadingTiers } = useSubscriptionTiers();
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedCheckoutPlan, setSelectedCheckoutPlan] = useState<string | null>(null);

  // Get selected plan from URL query param
  const selectedPlanId = searchParams.get('plan') || 'core';

  log.debug('Selected plan from URL:', selectedPlanId);

  // Get current plan details from tiers
  const selectedPlan = useMemo(() => {
    return tiers?.find(t => t.plan_id === selectedPlanId);
  }, [tiers, selectedPlanId]);

  // Determine upgrade targets based on selected plan
  const upgradePlans = useMemo(() => {
    if (!tiers) return [];

    if (selectedPlanId === 'core') {
      // Core shows both Growth and Pro as upgrade options
      return tiers.filter(t => t.plan_id === 'growth' || t.plan_id === 'pro')
        .sort((a, b) => (a.price_cents || 0) - (b.price_cents || 0));
    }

    // All others show just next tier up
    const currentPlanIndex = PLAN_HIERARCHY.indexOf(selectedPlanId);
    const nextPlanId = currentPlanIndex >= 0 && currentPlanIndex < PLAN_HIERARCHY.length - 1
      ? PLAN_HIERARCHY[currentPlanIndex + 1]
      : null;
    const nextPlan = nextPlanId ? tiers.find(t => t.plan_id === nextPlanId) : null;
    return nextPlan ? [nextPlan] : [];
  }, [selectedPlanId, tiers]);

  log.debug('Plan state:', { selectedPlanId, upgradePlans: upgradePlans.map(p => p.plan_id) });

  // Handle Stripe checkout
  const handleCheckout = async (planId: string) => {
    if (!session) {
      toast({
        title: "Session expired",
        description: "Please log in again.",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    setIsProcessing(true);
    setSelectedCheckoutPlan(planId);

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
      setIsProcessing(false);
      setSelectedCheckoutPlan(null);
    }
  };

  // Helper to compute features gained by upgrading (only NEW features)
  const getNewFeatures = (toPlan: typeof selectedPlan) => {
    if (!selectedPlan || !toPlan) return [];
    const fromFeatures = new Set(selectedPlan.features as string[]);
    return ((toPlan.features as string[]) || []).filter(f => !fromFeatures.has(f));
  };

  // Loading state
  if (isLoadingTiers || !selectedPlan || upgradePlans.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const formatPrice = (priceCents: number) => {
    return Math.floor(priceCents / 100);
  };

  // Determine grid columns based on number of cards (1 current + N upgrade options)
  const totalCards = 1 + upgradePlans.length;
  const gridCols = totalCards === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3';

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
              <p className="text-sm text-muted-foreground">Step 2 of 5 • Upgrade your plan</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Intro */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto mb-4">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold mb-3">
            Get More from Your AI Agent
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Unlock advanced features and handle more calls with an upgraded plan. Upgrade now or continue with your selected plan.
          </p>
        </motion.div>

        {/* Comparison Cards */}
        <div className={`grid ${gridCols} gap-6 mb-8`}>
          {/* Selected Plan */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card border rounded-xl p-6"
          >
            <div className="mb-4">
              <h3 className="font-display text-xl font-bold mb-1">{selectedPlan.name}</h3>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">${formatPrice(selectedPlan.price_cents)}</span>
                <span className="text-muted-foreground text-sm">/month</span>
              </div>
            </div>

            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                <span className="text-sm">{selectedPlan.credits} credits/month (~{Math.floor(selectedPlan.credits / 3)} calls)</span>
              </li>
              {selectedPlan.features && (selectedPlan.features as string[]).map((feature: string, idx: number) => (
                <li key={idx} className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                  <span className="text-sm">{feature}</span>
                </li>
              ))}
            </ul>

            <Button
              variant="outline"
              size="lg"
              className="w-full mt-6"
              onClick={() => handleCheckout(selectedPlanId)}
              disabled={isProcessing}
            >
              {isProcessing && selectedCheckoutPlan === selectedPlanId ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  Continue with {selectedPlan.name}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </motion.div>

          {/* Upgrade Plan(s) */}
          {upgradePlans.map((upgradePlan, index) => {
            const newFeatures = getNewFeatures(upgradePlan);
            const isRecommended = index === 0; // First upgrade option is recommended

            return (
              <motion.div
                key={upgradePlan.plan_id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + index * 0.1 }}
                className={`${isRecommended ? 'bg-gradient-to-br from-primary/10 to-accent/10 border-2 border-primary' : 'bg-card border'} rounded-xl p-6 relative`}
              >
                {/* Recommended Badge */}
                {isRecommended && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-block px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                      Recommended
                    </span>
                  </div>
                )}

                <div className="mb-4">
                  <h3 className="font-display text-xl font-bold mb-1">{upgradePlan.name}</h3>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold">${formatPrice(upgradePlan.price_cents)}</span>
                    <span className="text-muted-foreground text-sm">/month</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    ${formatPrice(upgradePlan.price_cents - selectedPlan.price_cents)} more than {selectedPlan.name}
                  </p>
                </div>

                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <Check className={`w-5 h-5 ${isRecommended ? 'text-primary' : 'text-success'} flex-shrink-0 mt-0.5`} />
                    <span className="text-sm font-medium">{upgradePlan.credits} credits/month (~{Math.floor(upgradePlan.credits / 3)} calls)</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Sparkles className={`w-5 h-5 ${isRecommended ? 'text-primary' : 'text-success'} flex-shrink-0 mt-0.5`} />
                    <span className="text-sm font-medium">+{upgradePlan.credits - selectedPlan.credits} more credits</span>
                  </li>
                  {/* Show only NEW features gained by upgrading */}
                  {newFeatures.map((feature: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-3">
                      <Sparkles className={`w-5 h-5 ${isRecommended ? 'text-primary' : 'text-success'} flex-shrink-0 mt-0.5`} />
                      <span className="text-sm font-medium">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  size="lg"
                  className={`w-full mt-6 ${isRecommended ? 'bg-primary hover:bg-primary/90' : ''}`}
                  variant={isRecommended ? 'default' : 'outline'}
                  onClick={() => handleCheckout(upgradePlan.plan_id)}
                  disabled={isProcessing}
                >
                  {isProcessing && selectedCheckoutPlan === upgradePlan.plan_id ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 mr-2" />
                      Upgrade to {upgradePlan.name}
                    </>
                  )}
                </Button>
              </motion.div>
            );
          })}
        </div>

        {/* Info Box */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-info/10 border border-info/20 rounded-lg p-4 text-center"
        >
          <p className="text-sm text-muted-foreground">
            You can upgrade or downgrade your plan anytime from your dashboard settings. No commitments required.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
