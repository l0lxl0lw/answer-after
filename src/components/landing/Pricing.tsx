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

  const getButtonVariant = (planId: string, isPopular: boolean) => {
    if (isPopular) return "hero" as const;
    return "outline" as const;
  };

  const getCta = (planId: string) => {
    if (planId === "enterprise") return "Contact Sales";
    return "Start for $1";
  };

  const isEnterprise = (planId: string) => planId === "enterprise";

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
            Simple, Transparent{" "}
            <span className="text-gradient">Pricing</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            No free tier. No clutter. Just plans that grow with your business.
            <br />
            <span className="font-medium text-foreground">Try any plan for just $1 your first month.</span>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {tiers.map((tier, index) => (
              <motion.div
                key={tier.plan_id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="relative flex flex-col"
              >
                {/* $1 First Month Banner or Enterprise Banner */}
                <div className={`text-center py-2.5 px-4 rounded-t-2xl text-sm font-semibold ${
                  tier.is_popular 
                    ? "bg-primary text-primary-foreground" 
                    : isEnterprise(tier.plan_id)
                    ? "bg-muted text-muted-foreground"
                    : "bg-accent/20 text-foreground"
                }`}>
                  {isEnterprise(tier.plan_id) ? "Custom pricing" : "$1/month for your first month"}
                </div>
                
                <div className={`flex-1 flex flex-col rounded-b-2xl p-6 ${
                  tier.is_popular
                    ? "bg-card border-2 border-primary shadow-glow"
                    : "bg-card border border-border"
                }`}>
                  {/* Plan Header */}
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-display font-semibold text-xl">{tier.name}</h3>
                      {tier.is_popular && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                          <Sparkles className="w-3 h-3" />
                          Most Popular
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground text-sm">{tier.description}</p>
                  </div>

                  {/* Price */}
                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className="font-display text-4xl font-bold">{formatPrice(tier.price_cents)}</span>
                      {tier.period && <span className="text-muted-foreground">{tier.period}</span>}
                    </div>
                    {!isEnterprise(tier.plan_id) && (
                      <p className="text-xs text-muted-foreground mt-1">(after first month)</p>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="space-y-3 mb-6 flex-1">
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
                  <Button 
                    variant={getButtonVariant(tier.plan_id, tier.is_popular)} 
                    size="lg"
                    className="w-full"
                    asChild
                  >
                    <Link to="/auth">{getCta(tier.plan_id)}</Link>
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Bottom Note */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-12 text-center max-w-2xl mx-auto"
        >
          <p className="text-muted-foreground text-sm">
            All plans include 24/7 AI call answering, appointment booking, and reminder calls.
            <br />
            Annual discounts available after your first month.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
