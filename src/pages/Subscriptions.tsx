import { useEffect } from "react";
import { motion } from "framer-motion";
import { Link, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Check, Loader2, ArrowRight, Plus } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useSubscription, useSubscriptionTiers, SubscriptionTier } from "@/hooks/use-api";
import { useCreateCreditTopup, useTotalAvailableCredits } from "@/hooks/use-credits";
import { cn } from "@/lib/utils";
import { shouldSkipStripe } from "@/lib/environment";
import { useToast } from "@/hooks/use-toast";
import { toast } from "sonner";
import { LINKS } from "@/lib/constants";

export default function Subscriptions() {
  const { data: subscription, isLoading: subscriptionLoading } = useSubscription();
  const { data: tiers, isLoading: tiersLoading } = useSubscriptionTiers();
  const { purchasedCredits } = useTotalAvailableCredits();
  const createTopup = useCreateCreditTopup();
  const { toast: shadcnToast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const currentPlan = subscription?.plan?.toLowerCase() || "core";
  const isLoading = subscriptionLoading || tiersLoading;

  // Handle topup success - invalidate cache and show toast
  useEffect(() => {
    const topupStatus = searchParams.get('topup');
    const creditsAdded = searchParams.get('credits');

    if (topupStatus === 'success') {
      // Invalidate purchased credits cache to fetch fresh data
      queryClient.invalidateQueries({ queryKey: ['purchased-credits'] });

      // Show success toast
      toast.success('Credits added!', {
        description: `${creditsAdded || '300'} credits have been added to your account.`,
      });

      // Clean up URL params
      searchParams.delete('topup');
      searchParams.delete('credits');
      setSearchParams(searchParams, { replace: true });
    } else if (topupStatus === 'cancelled') {
      toast.info('Top-up cancelled', {
        description: 'Your credit purchase was cancelled.',
      });

      // Clean up URL params
      searchParams.delete('topup');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, queryClient]);

  const handleTopup = async () => {
    // Skip Stripe in local/development environment
    if (shouldSkipStripe()) {
      shadcnToast({
        title: "Development Mode",
        description: "Stripe credit top-ups are disabled in local environment.",
      });
      return;
    }

    const result = await createTopup.mutateAsync();
    if (result?.url) {
      window.location.href = result.url;
    }
  };

  const formatPrice = (priceCents: number) => {
    if (priceCents < 0) return "Custom";
    return Math.floor(priceCents / 100);
  };

  const formatCredits = (credits: number) => {
    if (credits <= 0) return "Custom";
    return credits.toLocaleString();
  };

  const getPlanIndex = (planId: string) => tiers?.findIndex(t => t.plan_id === planId) ?? -1;
  const currentPlanIndex = getPlanIndex(currentPlan);

  const isEnterprise = (planId: string) => planId === "enterprise";
  const isBusiness = (planId: string) => planId === "business";

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-3xl mx-auto mb-10"
        >
          <h1 className="font-display text-3xl sm:text-4xl font-bold mb-3">
            Choose Your Plan
          </h1>
          <p className="text-muted-foreground">
            Plans that grow with your business. No hidden fees.
          </p>
        </motion.div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {/* Current Usage */}
        {!isLoading && subscription && (() => {
          const planTotal = subscription.total_credits || 0;
          const planUsed = subscription.used_credits || 0;
          const planRemaining = planTotal - planUsed;
          const totalAvailable = planRemaining + purchasedCredits;
          const totalPool = planTotal + purchasedCredits;
          const percentageUsed = totalPool > 0 ? (planUsed / totalPool) * 100 : 0;

          return (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mb-8 p-5 rounded-xl bg-card border border-border max-w-md mx-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-muted-foreground capitalize">{subscription.plan} Plan</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={handleTopup}
                  disabled={createTopup.isPending}
                >
                  {createTopup.isPending ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-3 h-3 mr-1" />
                      Top Up
                    </>
                  )}
                </Button>
              </div>

              {/* Main credit display */}
              <div className="text-center mb-4">
                <div className="text-4xl font-bold text-foreground">
                  {totalAvailable.toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">credits available</div>
              </div>

              {/* Progress bar */}
              <div className="h-2 rounded-full bg-muted overflow-hidden mb-3">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    percentageUsed > 80 ? "bg-destructive" :
                    percentageUsed > 50 ? "bg-warning" : "bg-success"
                  )}
                  style={{ width: `${100 - Math.min(percentageUsed, 100)}%` }}
                />
              </div>

              {/* Breakdown */}
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Monthly plan</span>
                  <span>
                    <span className="font-medium">{planRemaining.toLocaleString()}</span>
                    <span className="text-muted-foreground"> / {planTotal.toLocaleString()}</span>
                  </span>
                </div>
                {purchasedCredits > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Bonus credits</span>
                    <span className="font-medium text-success">+{purchasedCredits.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })()}

        {/* Pricing Cards */}
        {!isLoading && tiers && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {tiers.map((tier, index) => {
              const isCurrentPlan = tier.plan_id === currentPlan;
              const isUpgrade = getPlanIndex(tier.plan_id) > currentPlanIndex;
              const isDowngrade = getPlanIndex(tier.plan_id) < currentPlanIndex;

              return (
                <motion.div
                  key={tier.plan_id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.08 }}
                  className="relative flex flex-col"
                >
                  <div className={cn(
                    "flex-1 flex flex-col rounded-xl p-4 transition-all",
                    isCurrentPlan
                      ? "bg-primary/10 border-2 border-primary"
                      : tier.is_popular
                        ? "bg-primary text-primary-foreground ring-2 ring-primary shadow-lg"
                        : isBusiness(tier.plan_id)
                          ? "bg-card border-2 border-accent"
                          : "bg-card border border-border"
                  )}>
                    {/* Badges */}
                    {isCurrentPlan && (
                      <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                        <span className="inline-block px-3 py-0.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                          Current Plan
                        </span>
                      </div>
                    )}
                    {tier.is_popular && !isCurrentPlan && (
                      <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                        <span className="inline-block px-3 py-0.5 rounded-full bg-accent text-accent-foreground text-xs font-semibold">
                          Most Popular
                        </span>
                      </div>
                    )}
                    {isBusiness(tier.plan_id) && !isCurrentPlan && (
                      <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                        <span className="inline-block px-3 py-0.5 rounded-full bg-accent text-accent-foreground text-xs font-semibold whitespace-nowrap">
                          Best for High Volume
                        </span>
                      </div>
                    )}

                    {/* Plan Header */}
                    <div className="mb-3 mt-2">
                      <h3 className={cn(
                        "font-display font-semibold text-base mb-0.5",
                        tier.is_popular && !isCurrentPlan ? "text-primary-foreground" : "text-foreground"
                      )}>
                        {tier.name}
                      </h3>
                      <p className={cn(
                        "text-xs",
                        tier.is_popular && !isCurrentPlan ? "text-primary-foreground/80" : "text-muted-foreground"
                      )}>
                        {tier.description}
                      </p>
                    </div>

                    {/* Price */}
                    <div className="mb-4">
                      {isEnterprise(tier.plan_id) ? (
                        <div className={cn(
                          "font-display text-xl font-bold",
                          tier.is_popular && !isCurrentPlan ? "text-primary-foreground" : "text-foreground"
                        )}>
                          Custom
                        </div>
                      ) : (
                        <>
                          <div className="flex items-baseline gap-0.5">
                            <span className={cn(
                              "font-display text-2xl font-bold",
                              tier.is_popular && !isCurrentPlan ? "text-primary-foreground" : "text-foreground"
                            )}>
                              ${formatPrice(tier.price_cents)}
                            </span>
                            <span className={cn(
                              "text-xs",
                              tier.is_popular && !isCurrentPlan ? "text-primary-foreground/70" : "text-muted-foreground"
                            )}>
                              /mo
                            </span>
                          </div>
                          <p className={cn(
                            "text-xs",
                            tier.is_popular && !isCurrentPlan ? "text-primary-foreground/70" : "text-muted-foreground"
                          )}>
                            billed monthly
                          </p>
                        </>
                      )}
                    </div>

                    {/* Features */}
                    <ul className="space-y-2 mb-4 flex-1">
                      {tier.features.map((feature: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <div className={cn(
                            "w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                            tier.is_popular && !isCurrentPlan ? "bg-primary-foreground/20" : "bg-success/10"
                          )}>
                            <Check className={cn(
                              "w-2 h-2",
                              tier.is_popular && !isCurrentPlan ? "text-primary-foreground" : "text-success"
                            )} />
                          </div>
                          <span className={cn(
                            "text-xs",
                            tier.is_popular && !isCurrentPlan ? "text-primary-foreground/90" : "text-foreground"
                          )}>
                            {feature}
                          </span>
                        </li>
                      ))}
                    </ul>

                    {/* CTA */}
                    {isCurrentPlan ? (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full pointer-events-none opacity-70"
                        disabled
                      >
                        Current Plan
                      </Button>
                    ) : (
                      <Button 
                        variant={tier.is_popular ? "secondary" : isEnterprise(tier.plan_id) ? "outline" : "default"}
                        size="sm" 
                        className={cn(
                          "w-full",
                          tier.is_popular && "bg-primary-foreground text-primary hover:bg-primary-foreground/90"
                        )}
                        asChild
                      >
                        <Link to={isEnterprise(tier.plan_id) ? LINKS.salesEmail : "/dashboard/account"}>
                          {isEnterprise(tier.plan_id) ? "Contact Sales" : isUpgrade ? "Upgrade" : isDowngrade ? "Downgrade" : "Select"}
                          <ArrowRight className="w-3.5 h-3.5 ml-1" />
                        </Link>
                      </Button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Extra Credits Note */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-10 text-center max-w-xl mx-auto"
        >
          <div className="bg-card border border-border rounded-xl p-5">
            <h4 className="font-semibold text-foreground mb-2">Need more capacity?</h4>
            <p className="text-muted-foreground text-sm mb-4">
              Top up anytime with 300 credits for just $10. Credits never expire and are used first.
            </p>
            <Button 
              onClick={handleTopup}
              disabled={createTopup.isPending}
              className="gap-2"
            >
              {createTopup.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Buy 300 Credits for $10
                </>
              )}
            </Button>
          </div>
        </motion.div>

        {/* Plan Comparison Table */}
        {!isLoading && tiers && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="mt-12"
          >
            <h3 className="font-display text-xl font-semibold text-center mb-6">Plan Comparison</h3>
            <div className="rounded-xl border border-border overflow-hidden bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left p-3 font-semibold">Feature</th>
                      {tiers.map((tier) => (
                        <th 
                          key={tier.plan_id} 
                          className={cn(
                            "text-center p-3 font-semibold min-w-[100px]",
                            tier.plan_id === currentPlan && "bg-primary/10"
                          )}
                        >
                          {tier.name}
                          {tier.plan_id === currentPlan && (
                            <span className="block text-xs font-normal text-primary mt-0.5">Current</span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border">
                      <td className="p-3 font-medium">Monthly Price</td>
                      {tiers.map((tier) => (
                        <td 
                          key={tier.plan_id} 
                          className={cn(
                            "text-center p-3",
                            tier.plan_id === currentPlan && "bg-primary/5"
                          )}
                        >
                          {isEnterprise(tier.plan_id) ? "Custom" : `$${formatPrice(tier.price_cents)}/mo`}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b border-border">
                      <td className="p-3 font-medium">Monthly Credits</td>
                      {tiers.map((tier) => (
                        <td 
                          key={tier.plan_id} 
                          className={cn(
                            "text-center p-3",
                            tier.plan_id === currentPlan && "bg-primary/5"
                          )}
                        >
                          {formatCredits(tier.credits)}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b border-border">
                      <td className="p-3 font-medium">Phone Numbers</td>
                      {tiers.map((tier) => (
                        <td 
                          key={tier.plan_id} 
                          className={cn(
                            "text-center p-3",
                            tier.plan_id === currentPlan && "bg-primary/5"
                          )}
                        >
                          {tier.phone_lines <= 0 ? "Custom" : tier.phone_lines}
                        </td>
                      ))}
                    </tr>
                    <ComparisonRow 
                      label="Custom AI Agent" 
                      tiers={tiers} 
                      getValue={(t) => t.has_custom_agent} 
                      currentPlan={currentPlan}
                    />
                    <ComparisonRow 
                      label="Outbound Reminders" 
                      tiers={tiers} 
                      getValue={(t) => t.has_outbound_reminders} 
                      currentPlan={currentPlan}
                    />
                    <ComparisonRow 
                      label="Call Recordings" 
                      tiers={tiers} 
                      getValue={(t) => t.has_call_recordings} 
                      currentPlan={currentPlan}
                    />
                    <ComparisonRow 
                      label="Priority Support" 
                      tiers={tiers} 
                      getValue={(t) => t.has_priority_support} 
                      currentPlan={currentPlan}
                    />
                    <ComparisonRow 
                      label="API Access" 
                      tiers={tiers} 
                      getValue={(t) => t.has_api_access} 
                      currentPlan={currentPlan}
                    />
                    <ComparisonRow 
                      label="SLA Guarantee" 
                      tiers={tiers} 
                      getValue={(t) => t.has_sla_guarantee} 
                      currentPlan={currentPlan}
                    />
                    <ComparisonRow 
                      label="HIPAA Compliance" 
                      tiers={tiers} 
                      getValue={(t) => t.has_hipaa_compliance} 
                      currentPlan={currentPlan}
                    />
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  );
}

function ComparisonRow({ 
  label, 
  tiers, 
  getValue, 
  currentPlan 
}: { 
  label: string; 
  tiers: SubscriptionTier[]; 
  getValue: (tier: SubscriptionTier) => boolean; 
  currentPlan: string;
}) {
  return (
    <tr className="border-b border-border">
      <td className="p-3 font-medium">{label}</td>
      {tiers.map((tier) => (
        <td 
          key={tier.plan_id} 
          className={cn(
            "text-center p-3",
            tier.plan_id === currentPlan && "bg-primary/5"
          )}
        >
          {getValue(tier) ? (
            <Check className="w-4 h-4 text-success mx-auto" />
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
      ))}
    </tr>
  );
}
