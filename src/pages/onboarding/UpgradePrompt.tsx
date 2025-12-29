import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Zap, Check, Loader2 } from "lucide-react";
import { COMPANY } from "@/lib/constants";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";
import { useSubscriptionTiers } from "@/hooks/use-api";
import { useEffect } from "react";

export default function UpgradePrompt() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: tiers } = useSubscriptionTiers();

  // Fetch user's current subscription
  const { data: subscription, isLoading } = useQuery({
    queryKey: ['user-subscription', user?.organization_id],
    queryFn: async () => {
      if (!user?.organization_id) return null;

      // Fetch subscription
      const { data: subData, error: subError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('organization_id', user.organization_id)
        .maybeSingle();

      if (subError) {
        console.error('Error fetching subscription:', subError);
        return null;
      }

      if (!subData) return null;

      // Fetch the corresponding tier
      const { data: tierData, error: tierError } = await supabase
        .from('subscription_tiers')
        .select('plan_id, name, price_monthly_cents, credits_included, features')
        .eq('plan_id', subData.plan)
        .maybeSingle();

      if (tierError) {
        console.error('Error fetching tier:', tierError);
        return null;
      }

      if (!tierData) {
        console.error('No tier found for plan:', subData.plan);
        return null;
      }

      return {
        ...subData,
        subscription_tiers: tierData,
      };
    },
    enabled: !!user?.organization_id,
  });

  // Get current plan details
  const currentPlan = subscription?.subscription_tiers;
  const currentPlanId = currentPlan?.plan_id;

  // Skip this page if user has Pro or Business plan, or no subscription
  useEffect(() => {
    if (!isLoading) {
      // If no subscription at all, skip to next step
      if (!subscription) {
        console.warn('No subscription found, skipping upgrade prompt');
        navigate("/onboarding/setup-services", { replace: true });
        return;
      }

      // If Pro or Business, skip
      if (currentPlanId === 'pro' || currentPlanId === 'business') {
        navigate("/onboarding/setup-services", { replace: true });
      }
    }
  }, [isLoading, subscription, currentPlanId, navigate]);

  // Determine upgrade target
  const planHierarchy = ['core', 'growth', 'pro', 'business'];
  const currentPlanIndex = currentPlanId ? planHierarchy.indexOf(currentPlanId) : 0;
  const upgradePlanId = currentPlanIndex < planHierarchy.length - 1
    ? planHierarchy[currentPlanIndex + 1]
    : null;

  const upgradePlan = tiers?.find(t => t.plan_id === upgradePlanId);

  const handleSkip = () => {
    navigate("/onboarding/setup-services");
  };

  const handleUpgrade = () => {
    navigate("/dashboard/subscriptions");
  };

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
                <span className="text-3xl font-bold">${formatPrice(currentPlan.price_monthly_cents)}</span>
                <span className="text-muted-foreground text-sm">/month</span>
              </div>
            </div>

            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                <span className="text-sm">{currentPlan.credits_included} credits/month (~{Math.floor(currentPlan.credits_included / 3)} calls)</span>
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
                <span className="text-3xl font-bold">${formatPrice(upgradePlan.price_monthly_cents)}</span>
                <span className="text-muted-foreground text-sm">/month</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                ${formatPrice(upgradePlan.price_monthly_cents - currentPlan.price_monthly_cents)} more than {currentPlan.name}
              </p>
            </div>

            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <span className="text-sm font-medium">{upgradePlan.credits_included} credits/month (~{Math.floor(upgradePlan.credits_included / 3)} calls)</span>
              </li>
              <li className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <span className="text-sm font-medium">+{upgradePlan.credits_included - currentPlan.credits_included} more credits</span>
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
