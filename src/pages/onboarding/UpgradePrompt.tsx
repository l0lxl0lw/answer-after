import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Zap, Check, Loader2 } from "lucide-react";
import { COMPANY } from "@/lib/constants";
import { useAuth } from "@/contexts/AuthContext";
import { createLogger } from "@/lib/logger";
import { useCurrentSubscriptionTier, useSubscriptionTiers } from "@/hooks/use-api";
import { useEffect } from "react";

// Feature gating uses DB flags from subscription_tiers table:
// - has_custom_ai_training: Pro/Business plans have this, skip upgrade prompt for them

const log = createLogger('UpgradePrompt');

// Plan hierarchy for determining upgrades
const PLAN_HIERARCHY = ['core', 'growth', 'pro', 'business'];

export default function UpgradePrompt() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: tiers, isLoading: isLoadingTiers } = useSubscriptionTiers();

  // Use the new hook that provides subscription + tier data with feature flags
  const {
    subscription: subscriptionData,
    currentPlanId,
    currentTier,
    features,
    isLoading: isLoadingSubscription
  } = useCurrentSubscriptionTier();

  const isLoading = isLoadingTiers || isLoadingSubscription;

  log.debug('Current plan from database:', currentPlanId, 'Tier:', currentTier?.name);

  // Get current plan details from tiers (use currentTier from hook)
  const currentPlan = currentTier;

  // Determine upgrade target (next tier up)
  const currentPlanIndex = PLAN_HIERARCHY.indexOf(currentPlanId);
  const upgradePlanId = currentPlanIndex >= 0 && currentPlanIndex < PLAN_HIERARCHY.length - 1
    ? PLAN_HIERARCHY[currentPlanIndex + 1]
    : null;
  const upgradePlan = upgradePlanId ? tiers?.find(t => t.plan_id === upgradePlanId) : null;

  log.debug('Plan state:', { currentPlanId, currentPlanIndex, upgradePlanId, hasTiers: !!tiers?.length });

  // Redirect based on subscription status and feature flags
  useEffect(() => {
    if (!isLoading) {
      // If no subscription at all, redirect to plan selection
      if (!subscriptionData) {
        log.warn('No subscription found, redirecting to plan selection');
        navigate("/onboarding/select-plan", { replace: true });
        return;
      }

      // Skip upgrade prompt for plans with custom AI training (Pro/Business)
      // Using DB feature flag instead of hardcoded plan name check
      if (features.hasCustomAiTraining) {
        log.debug('Plan with custom AI training detected, skipping upgrade prompt');
        navigate("/onboarding/setup-services", { replace: true });
      }
    }
  }, [isLoading, subscriptionData, features.hasCustomAiTraining, navigate]);

  const handleSkip = () => {
    navigate("/onboarding/setup-services");
  };

  const handleUpgrade = () => {
    navigate("/dashboard/subscriptions");
  };

  // Loading state
  if (isLoading || !currentPlan || !upgradePlan) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const formatPrice = (priceCents: number) => {
    return Math.floor(priceCents / 100);
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
              <p className="text-sm text-muted-foreground">Step 3 of 6 • Upgrade your plan</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
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
            Unlock advanced features and handle more calls with {upgradePlan.name}. Upgrade now or continue with your current plan.
          </p>
        </motion.div>

        {/* Comparison Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Current Plan */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card border rounded-xl p-6"
          >
            <div className="mb-4">
              <h3 className="font-display text-xl font-bold mb-1">{currentPlan.name}</h3>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">${formatPrice(currentPlan.price_cents)}</span>
                <span className="text-muted-foreground text-sm">/month</span>
              </div>
            </div>

            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                <span className="text-sm">{currentPlan.credits} credits/month (~{Math.floor(currentPlan.credits / 3)} calls)</span>
              </li>
              {currentPlan.features && (currentPlan.features as string[]).map((feature: string, idx: number) => (
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
              onClick={handleSkip}
            >
              Continue with {currentPlan.name}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </motion.div>

          {/* Upgrade Plan */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-primary/10 to-accent/10 border-2 border-primary rounded-xl p-6 relative"
          >
            {/* Popular Badge */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="inline-block px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                Recommended
              </span>
            </div>

            <div className="mb-4">
              <h3 className="font-display text-xl font-bold mb-1">{upgradePlan.name}</h3>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">${formatPrice(upgradePlan.price_cents)}</span>
                <span className="text-muted-foreground text-sm">/month</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                ${formatPrice(upgradePlan.price_cents - currentPlan.price_cents)} more than {currentPlan.name}
              </p>
            </div>

            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <span className="text-sm font-medium">{upgradePlan.credits} credits/month (~{Math.floor(upgradePlan.credits / 3)} calls)</span>
              </li>
              <li className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <span className="text-sm font-medium">+{upgradePlan.credits - currentPlan.credits} more credits</span>
              </li>
              {upgradePlan.features && (upgradePlan.features as string[]).map((feature: string, idx: number) => (
                <li key={idx} className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-sm font-medium">{feature}</span>
                </li>
              ))}
            </ul>

            <Button
              size="lg"
              className="w-full mt-6 bg-primary hover:bg-primary/90"
              onClick={handleUpgrade}
            >
              <Zap className="w-4 h-4 mr-2" />
              Upgrade to {upgradePlan.name}
            </Button>
          </motion.div>
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
