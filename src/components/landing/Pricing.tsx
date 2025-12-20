import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, Loader2 } from "lucide-react";
import { useSubscriptionTiers } from "@/hooks/use-api";

export function Pricing() {
  const { data: tiers, isLoading } = useSubscriptionTiers();

  const formatPrice = (priceCents: number) => {
    if (priceCents < 0) return "Custom";
    return `$${priceCents / 100}`;
  };

  const formatCredits = (credits: number) => {
    if (credits < 0) return "Unlimited";
    return credits.toLocaleString();
  };

  const formatCreditsCost = (cost: number | null) => {
    if (!cost) return null;
    return `$${cost.toFixed(2)}/1000`;
  };

  const getButtonVariant = (planId: string, isPopular: boolean) => {
    if (isPopular) return "hero" as const;
    return "outline" as const;
  };

  const getCta = (planId: string) => {
    if (planId === "free") return "Get Started";
    if (planId === "enterprise") return "Contact Sales";
    return "Start Free Trial";
  };

  return (
    <section id="pricing" className="py-24 lg:py-32 relative">
      <div className="absolute inset-0 bg-gradient-subtle" />
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-3xl mx-auto mb-16 lg:mb-20"
        >
          <span className="inline-block px-4 py-2 rounded-full bg-accent/10 text-accent text-sm font-semibold mb-4">
            Pricing
          </span>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold mb-6">
            Simple, Credit-Based{" "}
            <span className="text-gradient">Pricing</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Pay only for what you use. 1 credit = 1 second of call time. All plans include a 14-day free trial.
          </p>
        </motion.div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {/* Pricing Cards */}
        {!isLoading && tiers && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {tiers.map((tier, index) => (
              <motion.div
                key={tier.plan_id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className={`relative rounded-3xl p-6 ${
                  tier.is_popular
                    ? "bg-card border-2 border-primary shadow-glow"
                    : "bg-card border border-border"
                }`}
              >
                {/* Popular Badge */}
                {tier.is_popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-hero text-sm font-semibold text-primary-foreground">
                      <Sparkles className="w-4 h-4" />
                      Most Popular
                    </span>
                  </div>
                )}

                {/* Plan Header */}
                <div className="mb-4">
                  <h3 className="font-display font-semibold text-xl mb-1">{tier.name}</h3>
                  <p className="text-muted-foreground text-sm">{tier.description}</p>
                </div>

                {/* Price */}
                <div className="mb-4">
                  <span className="font-display text-3xl font-bold">{formatPrice(tier.price_cents)}</span>
                  <span className="text-muted-foreground">{tier.period}</span>
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
                <ul className="space-y-2.5 mb-6">
                  {tier.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <div className="w-4 h-4 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="w-2.5 h-2.5 text-success" />
                      </div>
                      <span className="text-sm text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <Button 
                  variant={getButtonVariant(tier.plan_id, tier.is_popular)} 
                  size="lg" 
                  className="w-full"
                  asChild
                >
                  <Link to="/auth">{getCta(tier.plan_id)}</Link>
                </Button>
              </motion.div>
            ))}
          </div>
        )}

        {/* Credit Explanation */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-16 text-center max-w-2xl mx-auto"
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
    </section>
  );
}