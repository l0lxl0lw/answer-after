import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, Crown, Loader2 } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useSubscription, useSubscriptionTiers, SubscriptionTier } from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import { BillingToggle, BillingPeriod } from "@/components/pricing/BillingToggle";

export default function Subscriptions() {
  const { data: subscription, isLoading: subscriptionLoading } = useSubscription();
  const { data: tiers, isLoading: tiersLoading } = useSubscriptionTiers();
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("yearly");

  const currentPlan = subscription?.plan?.toLowerCase() || "starter";
  const isLoading = subscriptionLoading || tiersLoading;

  const formatPrice = (priceCents: number) => {
    if (priceCents < 0) return "Custom";
    return `$${priceCents / 100}`;
  };

  const getDisplayPrice = (tier: SubscriptionTier) => {
    if (tier.plan_id === "enterprise") return tier.price_cents;
    return billingPeriod === "yearly" ? tier.yearly_price_cents : tier.price_cents;
  };

  const formatCredits = (credits: number) => {
    if (credits < 0) return "Unlimited";
    return credits.toLocaleString();
  };

  const formatCreditsCost = (cost: number | null) => {
    if (!cost) return null;
    return `$${cost.toFixed(2)}/1000`;
  };

  const formatPhoneLines = (lines: number) => {
    if (lines < 0) return "Unlimited";
    return lines.toString();
  };

  const formatCallTime = (credits: number) => {
    if (credits < 0) return "Unlimited";
    return `~${Math.round(credits / 60)} min`;
  };

  const getPlanIndex = (planId: string) => tiers?.findIndex(t => t.plan_id === planId) ?? -1;
  const currentPlanIndex = getPlanIndex(currentPlan);

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-3xl mx-auto mb-12"
        >
          <h1 className="font-display text-3xl sm:text-4xl font-bold mb-4">
            Choose Your <span className="text-gradient">Plan</span>
          </h1>
          <p className="text-lg text-muted-foreground">
            Pay only for what you use. 1 credit = 1 second of call time.
          </p>
        </motion.div>

        {/* Billing Toggle */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="flex justify-center mb-10"
        >
          <BillingToggle value={billingPeriod} onChange={setBillingPeriod} discountPercent={25} />
        </motion.div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {/* Current Usage */}
        {!isLoading && subscription && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mb-10 p-6 rounded-2xl bg-card border border-border max-w-md mx-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-muted-foreground">Current Usage</span>
              <span className="text-sm font-medium capitalize">{subscription.plan} Plan</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Credits Used</span>
                <span className="font-semibold">
                  {subscription.used_credits?.toLocaleString()} / {subscription.total_credits?.toLocaleString()}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div 
                  className={cn(
                    "h-full rounded-full transition-all",
                    ((subscription.used_credits || 0) / (subscription.total_credits || 1)) > 0.8 
                      ? "bg-destructive" 
                      : ((subscription.used_credits || 0) / (subscription.total_credits || 1)) > 0.5 
                        ? "bg-warning" 
                        : "bg-success"
                  )}
                  style={{ 
                    width: `${Math.min(((subscription.used_credits || 0) / (subscription.total_credits || 1)) * 100, 100)}%` 
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                {((subscription.total_credits || 0) - (subscription.used_credits || 0)).toLocaleString()} credits remaining
              </p>
            </div>
          </motion.div>
        )}

        {/* Pricing Cards */}
        {!isLoading && tiers && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {tiers.map((tier, index) => {
              const isCurrentPlan = tier.plan_id === currentPlan;
              const isUpgrade = getPlanIndex(tier.plan_id) > currentPlanIndex;
              const isDowngrade = getPlanIndex(tier.plan_id) < currentPlanIndex;
              const isEnterprise = tier.plan_id === "enterprise";

              return (
                <motion.div
                  key={tier.plan_id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="relative flex flex-col"
                >
                  {/* Banner */}
                  <div className={cn(
                    "text-center py-2.5 px-4 rounded-t-2xl text-sm font-semibold",
                    isCurrentPlan
                      ? "bg-primary text-primary-foreground"
                      : tier.is_popular
                        ? "bg-accent text-accent-foreground"
                        : isEnterprise
                          ? "bg-muted text-muted-foreground"
                          : "bg-accent/20 text-foreground"
                  )}>
                    {isCurrentPlan 
                      ? "Current Plan" 
                      : isEnterprise 
                        ? "Custom pricing" 
                        : "$1/month for your first month"}
                  </div>
                  
                  <div className={cn(
                    "flex-1 flex flex-col rounded-b-2xl p-6",
                    isCurrentPlan
                      ? "bg-primary/5 border-2 border-primary border-t-0 shadow-glow"
                      : tier.is_popular
                        ? "bg-card border-2 border-accent border-t-0"
                        : "bg-card border border-border border-t-0"
                  )}>
                    {/* Plan Header */}
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-display font-semibold text-xl">{tier.name}</h3>
                        {tier.is_popular && !isCurrentPlan && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/10 text-accent text-xs font-semibold">
                            <Sparkles className="w-3 h-3" />
                            Most Popular
                          </span>
                        )}
                      </div>
                      <p className="text-muted-foreground text-sm">{tier.description}</p>
                    </div>

                    {/* Price */}
                    <div className="mb-4">
                      <div className="flex items-baseline gap-1">
                        <span className="font-display text-4xl font-bold">{formatPrice(getDisplayPrice(tier))}</span>
                        <span className="text-muted-foreground">
                          {isEnterprise ? "" : billingPeriod === "yearly" ? "/mo billed yearly" : "/month"}
                        </span>
                      </div>
                      {!isEnterprise && (
                        <p className="text-xs text-muted-foreground mt-1">(after first month)</p>
                      )}
                    </div>

                    {/* Credits Info */}
                    <div className="mb-4 p-3 rounded-lg bg-muted/50">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Credits included</span>
                        <span className="font-semibold">{formatCredits(tier.credits)}</span>
                      </div>
                      {formatCreditsCost(tier.credits_cost_per_thousand) && (
                        <div className="flex justify-between items-center text-sm mt-1">
                          <span className="text-muted-foreground">Additional credits</span>
                          <span className="font-medium text-primary">{formatCreditsCost(tier.credits_cost_per_thousand)}</span>
                        </div>
                      )}
                    </div>

                    {/* Features */}
                    <ul className="space-y-2.5 mb-6 flex-1">
                      {tier.features.filter((f: string) => !f.includes("$1")).map((feature: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2.5">
                          <div className="w-5 h-5 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Check className="w-3 h-3 text-success" />
                          </div>
                          <span className="text-sm text-foreground">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    {/* CTA */}
                    {isCurrentPlan ? (
                      <Button 
                        variant="outline" 
                        size="lg" 
                        className="w-full pointer-events-none opacity-70"
                        disabled
                      >
                        Current Plan
                      </Button>
                    ) : (
                      <Button 
                        variant={isUpgrade || tier.is_popular ? "hero" : "outline"} 
                        size="lg" 
                        className="w-full"
                        asChild
                      >
                        <Link to="/dashboard/settings">
                          {isEnterprise ? "Contact Sales" : isUpgrade ? "Upgrade" : isDowngrade ? "Downgrade" : "Select"}
                        </Link>
                      </Button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Tier Breakdown Table */}
        {!isLoading && tiers && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="mt-12"
          >
            <h3 className="font-display text-xl font-semibold text-center mb-6">Plan Comparison</h3>
            <div className="rounded-2xl border border-border overflow-hidden bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left p-4 font-semibold">Feature</th>
                      {tiers.map((tier) => (
                        <th 
                          key={tier.plan_id} 
                          className={cn(
                            "text-center p-4 font-semibold min-w-[120px]",
                            tier.plan_id === currentPlan && "bg-primary/10"
                          )}
                        >
                          {tier.name}
                          {tier.plan_id === currentPlan && (
                            <span className="block text-xs font-normal text-primary mt-1">Current</span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border">
                      <td className="p-4 font-medium">{billingPeriod === "yearly" ? "Price (billed yearly)" : "Monthly Price"}</td>
                      {tiers.map((tier) => (
                        <td 
                          key={tier.plan_id} 
                          className={cn(
                            "text-center p-4",
                            tier.plan_id === currentPlan && "bg-primary/5"
                          )}
                        >
                          {formatPrice(getDisplayPrice(tier))}{tier.plan_id !== "enterprise" ? (billingPeriod === "yearly" ? "/mo" : "/month") : ""}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b border-border">
                      <td className="p-4 font-medium">Credits Included</td>
                      {tiers.map((tier) => (
                        <td 
                          key={tier.plan_id} 
                          className={cn(
                            "text-center p-4",
                            tier.plan_id === currentPlan && "bg-primary/5"
                          )}
                        >
                          {formatCredits(tier.credits)}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b border-border">
                      <td className="p-4 font-medium">Approx. Call Time</td>
                      {tiers.map((tier) => (
                        <td 
                          key={tier.plan_id} 
                          className={cn(
                            "text-center p-4",
                            tier.plan_id === currentPlan && "bg-primary/5"
                          )}
                        >
                          {formatCallTime(tier.credits)}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b border-border">
                      <td className="p-4 font-medium">Additional Credit Cost</td>
                      {tiers.map((tier) => (
                        <td 
                          key={tier.plan_id} 
                          className={cn(
                            "text-center p-4",
                            tier.plan_id === currentPlan && "bg-primary/5"
                          )}
                        >
                          {formatCreditsCost(tier.credits_cost_per_thousand) || "—"}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b border-border">
                      <td className="p-4 font-medium">Phone Lines</td>
                      {tiers.map((tier) => (
                        <td 
                          key={tier.plan_id} 
                          className={cn(
                            "text-center p-4",
                            tier.plan_id === currentPlan && "bg-primary/5"
                          )}
                        >
                          {formatPhoneLines(tier.phone_lines)}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b border-border">
                      <td className="p-4 font-medium">Custom AI Training</td>
                      {tiers.map((tier) => (
                        <td 
                          key={tier.plan_id} 
                          className={cn(
                            "text-center p-4",
                            tier.plan_id === currentPlan && "bg-primary/5"
                          )}
                        >
                          {tier.has_custom_ai_training ? <Check className="w-4 h-4 text-success mx-auto" /> : "—"}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b border-border">
                      <td className="p-4 font-medium">Call Recordings</td>
                      {tiers.map((tier) => (
                        <td 
                          key={tier.plan_id} 
                          className={cn(
                            "text-center p-4",
                            tier.plan_id === currentPlan && "bg-primary/5"
                          )}
                        >
                          {tier.has_call_recordings ? <Check className="w-4 h-4 text-success mx-auto" /> : "—"}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b border-border">
                      <td className="p-4 font-medium">API Access</td>
                      {tiers.map((tier) => (
                        <td 
                          key={tier.plan_id} 
                          className={cn(
                            "text-center p-4",
                            tier.plan_id === currentPlan && "bg-primary/5"
                          )}
                        >
                          {tier.has_api_access ? <Check className="w-4 h-4 text-success mx-auto" /> : "—"}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b border-border">
                      <td className="p-4 font-medium">Priority Support</td>
                      {tiers.map((tier) => (
                        <td 
                          key={tier.plan_id} 
                          className={cn(
                            "text-center p-4",
                            tier.plan_id === currentPlan && "bg-primary/5"
                          )}
                        >
                          {tier.has_priority_support ? (
                            tier.support_level === "dedicated_24_7" ? "24/7 Dedicated" : <Check className="w-4 h-4 text-success mx-auto" />
                          ) : "—"}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b border-border">
                      <td className="p-4 font-medium">HIPAA Compliance</td>
                      {tiers.map((tier) => (
                        <td 
                          key={tier.plan_id} 
                          className={cn(
                            "text-center p-4",
                            tier.plan_id === currentPlan && "bg-primary/5"
                          )}
                        >
                          {tier.has_hipaa_compliance ? <Check className="w-4 h-4 text-success mx-auto" /> : "—"}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="p-4 font-medium">SLA Guarantee</td>
                      {tiers.map((tier) => (
                        <td 
                          key={tier.plan_id} 
                          className={cn(
                            "text-center p-4",
                            tier.plan_id === currentPlan && "bg-primary/5"
                          )}
                        >
                          {tier.has_sla_guarantee ? <Check className="w-4 h-4 text-success mx-auto" /> : "—"}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* Credit Explanation */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="mt-12 text-center max-w-2xl mx-auto"
        >
          <div className="p-6 rounded-2xl bg-card border border-border">
            <h4 className="font-display font-semibold text-lg mb-2">How Credits Work</h4>
            <p className="text-muted-foreground text-sm">
              Each second of AI call handling uses 1 credit. A typical 5-minute call uses 300 credits. 
              Credits reset monthly on paid plans. Unused credits don't roll over.
            </p>
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}