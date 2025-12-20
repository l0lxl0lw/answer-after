import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, Crown } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useSubscription } from "@/hooks/use-api";
import { cn } from "@/lib/utils";

const plans = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "/month",
    description: "Get started with 1,000 free credits.",
    credits: "1,000",
    totalCredits: 1000,
    creditsCost: null,
    features: [
      "1,000 credits included",
      "1 credit per call second",
      "~16 minutes of call time",
      "1 phone line",
      "Basic AI call handling",
      "Email notifications",
    ],
    cta: "Current Plan",
    ctaUpgrade: "Downgrade",
  },
  {
    id: "starter",
    name: "Starter",
    price: "$49",
    period: "/month",
    description: "For small service businesses.",
    credits: "10,000",
    totalCredits: 10000,
    creditsCost: "$0.50/1000",
    features: [
      "10,000 credits included",
      "~166 minutes of call time",
      "2 phone lines",
      "Advanced AI with custom rules",
      "SMS + Email notifications",
      "Analytics dashboard",
    ],
    cta: "Current Plan",
    ctaUpgrade: "Upgrade",
  },
  {
    id: "professional",
    name: "Professional",
    price: "$149",
    period: "/month",
    description: "For growing businesses.",
    credits: "50,000",
    totalCredits: 50000,
    creditsCost: "$0.35/1000",
    features: [
      "50,000 credits included",
      "~833 minutes of call time",
      "5 phone lines",
      "Custom AI training",
      "Priority support",
      "Call recordings",
      "API access",
    ],
    cta: "Current Plan",
    ctaUpgrade: "Upgrade",
    popular: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For large businesses.",
    credits: "Unlimited",
    totalCredits: Infinity,
    creditsCost: "$0.20/1000",
    features: [
      "Unlimited credits",
      "Unlimited phone lines",
      "Custom AI training",
      "24/7 dedicated support",
      "Advanced analytics & API",
      "HIPAA compliance",
      "Custom integrations",
      "SLA guarantee",
    ],
    cta: "Current Plan",
    ctaUpgrade: "Contact Sales",
  },
];

export default function Subscriptions() {
  const { data: subscription, isLoading } = useSubscription();

  const currentPlan = subscription?.plan?.toLowerCase() || "starter";

  const getPlanIndex = (planId: string) => plans.findIndex(p => p.id === planId);
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

        {/* Current Usage */}
        {subscription && (
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan, index) => {
            const isCurrentPlan = plan.id === currentPlan;
            const isUpgrade = getPlanIndex(plan.id) > currentPlanIndex;
            const isDowngrade = getPlanIndex(plan.id) < currentPlanIndex;

            return (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className={cn(
                  "relative rounded-3xl p-6 transition-all",
                  isCurrentPlan
                    ? "bg-primary/5 border-2 border-primary shadow-glow ring-2 ring-primary/20"
                    : plan.popular
                      ? "bg-card border-2 border-accent/50"
                      : "bg-card border border-border"
                )}
              >
                {/* Current Plan Badge */}
                {isCurrentPlan && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-hero text-sm font-semibold text-primary-foreground">
                      <Crown className="w-4 h-4" />
                      Current Plan
                    </span>
                  </div>
                )}

                {/* Popular Badge (only show if not current plan) */}
                {plan.popular && !isCurrentPlan && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                      <Sparkles className="w-4 h-4" />
                      Most Popular
                    </span>
                  </div>
                )}

                {/* Plan Header */}
                <div className={cn("mb-4", (isCurrentPlan || plan.popular) && "mt-2")}>
                  <h3 className="font-display font-semibold text-xl mb-1">{plan.name}</h3>
                  <p className="text-muted-foreground text-sm">{plan.description}</p>
                </div>

                {/* Price */}
                <div className="mb-4">
                  <span className="font-display text-3xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>

                {/* Credits Info */}
                <div className="mb-4 p-3 rounded-lg bg-muted/50">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Credits included</span>
                    <span className="font-semibold">{plan.credits}</span>
                  </div>
                  {plan.creditsCost && (
                    <div className="flex justify-between items-center text-sm mt-1">
                      <span className="text-muted-foreground">Additional credits</span>
                      <span className="font-medium text-primary">{plan.creditsCost}</span>
                    </div>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-2.5 mb-6">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <div className="w-4 h-4 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="w-2.5 h-2.5 text-success" />
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
                    variant={isUpgrade ? "hero" : "outline"} 
                    size="lg" 
                    className="w-full"
                    asChild
                  >
                    <Link to="/dashboard/settings">
                      {isUpgrade ? "Upgrade" : isDowngrade ? "Downgrade" : "Select"}
                    </Link>
                  </Button>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Tier Breakdown Table */}
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
                    {plans.map((plan) => (
                      <th 
                        key={plan.id} 
                        className={cn(
                          "text-center p-4 font-semibold min-w-[120px]",
                          plan.id === currentPlan && "bg-primary/10"
                        )}
                      >
                        {plan.name}
                        {plan.id === currentPlan && (
                          <span className="block text-xs font-normal text-primary mt-1">Current</span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border">
                    <td className="p-4 font-medium">Monthly Price</td>
                    {plans.map((plan) => (
                      <td 
                        key={plan.id} 
                        className={cn(
                          "text-center p-4",
                          plan.id === currentPlan && "bg-primary/5"
                        )}
                      >
                        {plan.price}{plan.period}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-border">
                    <td className="p-4 font-medium">Credits Included</td>
                    {plans.map((plan) => (
                      <td 
                        key={plan.id} 
                        className={cn(
                          "text-center p-4",
                          plan.id === currentPlan && "bg-primary/5"
                        )}
                      >
                        {plan.credits}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-border">
                    <td className="p-4 font-medium">Approx. Call Time</td>
                    {plans.map((plan) => (
                      <td 
                        key={plan.id} 
                        className={cn(
                          "text-center p-4",
                          plan.id === currentPlan && "bg-primary/5"
                        )}
                      >
                        {plan.id === "enterprise" ? "Unlimited" : `~${Math.round(plan.totalCredits / 60)} min`}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-border">
                    <td className="p-4 font-medium">Additional Credit Cost</td>
                    {plans.map((plan) => (
                      <td 
                        key={plan.id} 
                        className={cn(
                          "text-center p-4",
                          plan.id === currentPlan && "bg-primary/5"
                        )}
                      >
                        {plan.creditsCost || "—"}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-border">
                    <td className="p-4 font-medium">Phone Lines</td>
                    <td className={cn("text-center p-4", currentPlan === "free" && "bg-primary/5")}>1</td>
                    <td className={cn("text-center p-4", currentPlan === "starter" && "bg-primary/5")}>2</td>
                    <td className={cn("text-center p-4", currentPlan === "professional" && "bg-primary/5")}>5</td>
                    <td className={cn("text-center p-4", currentPlan === "enterprise" && "bg-primary/5")}>Unlimited</td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="p-4 font-medium">Custom AI Training</td>
                    <td className={cn("text-center p-4", currentPlan === "free" && "bg-primary/5")}>—</td>
                    <td className={cn("text-center p-4", currentPlan === "starter" && "bg-primary/5")}>—</td>
                    <td className={cn("text-center p-4", currentPlan === "professional" && "bg-primary/5")}><Check className="w-4 h-4 text-success mx-auto" /></td>
                    <td className={cn("text-center p-4", currentPlan === "enterprise" && "bg-primary/5")}><Check className="w-4 h-4 text-success mx-auto" /></td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="p-4 font-medium">Call Recordings</td>
                    <td className={cn("text-center p-4", currentPlan === "free" && "bg-primary/5")}>—</td>
                    <td className={cn("text-center p-4", currentPlan === "starter" && "bg-primary/5")}>—</td>
                    <td className={cn("text-center p-4", currentPlan === "professional" && "bg-primary/5")}><Check className="w-4 h-4 text-success mx-auto" /></td>
                    <td className={cn("text-center p-4", currentPlan === "enterprise" && "bg-primary/5")}><Check className="w-4 h-4 text-success mx-auto" /></td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="p-4 font-medium">API Access</td>
                    <td className={cn("text-center p-4", currentPlan === "free" && "bg-primary/5")}>—</td>
                    <td className={cn("text-center p-4", currentPlan === "starter" && "bg-primary/5")}>—</td>
                    <td className={cn("text-center p-4", currentPlan === "professional" && "bg-primary/5")}><Check className="w-4 h-4 text-success mx-auto" /></td>
                    <td className={cn("text-center p-4", currentPlan === "enterprise" && "bg-primary/5")}><Check className="w-4 h-4 text-success mx-auto" /></td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="p-4 font-medium">Priority Support</td>
                    <td className={cn("text-center p-4", currentPlan === "free" && "bg-primary/5")}>—</td>
                    <td className={cn("text-center p-4", currentPlan === "starter" && "bg-primary/5")}>—</td>
                    <td className={cn("text-center p-4", currentPlan === "professional" && "bg-primary/5")}><Check className="w-4 h-4 text-success mx-auto" /></td>
                    <td className={cn("text-center p-4", currentPlan === "enterprise" && "bg-primary/5")}>24/7 Dedicated</td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="p-4 font-medium">HIPAA Compliance</td>
                    <td className={cn("text-center p-4", currentPlan === "free" && "bg-primary/5")}>—</td>
                    <td className={cn("text-center p-4", currentPlan === "starter" && "bg-primary/5")}>—</td>
                    <td className={cn("text-center p-4", currentPlan === "professional" && "bg-primary/5")}>—</td>
                    <td className={cn("text-center p-4", currentPlan === "enterprise" && "bg-primary/5")}><Check className="w-4 h-4 text-success mx-auto" /></td>
                  </tr>
                  <tr>
                    <td className="p-4 font-medium">SLA Guarantee</td>
                    <td className={cn("text-center p-4", currentPlan === "free" && "bg-primary/5")}>—</td>
                    <td className={cn("text-center p-4", currentPlan === "starter" && "bg-primary/5")}>—</td>
                    <td className={cn("text-center p-4", currentPlan === "professional" && "bg-primary/5")}>—</td>
                    <td className={cn("text-center p-4", currentPlan === "enterprise" && "bg-primary/5")}><Check className="w-4 h-4 text-success mx-auto" /></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>

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
