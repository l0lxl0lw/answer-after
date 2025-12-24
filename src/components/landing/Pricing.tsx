import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Check, Loader2, ArrowRight } from "lucide-react";
import { useSubscriptionTiers } from "@/hooks/use-api";
import { BillingToggle, BillingPeriod } from "@/components/pricing/BillingToggle";

export function Pricing() {
  const { data: tiers, isLoading } = useSubscriptionTiers();
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("yearly");

  const formatPrice = (priceCents: number) => {
    if (priceCents < 0) return "Custom";
    return Math.floor(priceCents / 100);
  };

  const getDisplayPrice = (tier: NonNullable<typeof tiers>[number]) => {
    if (tier.plan_id === "enterprise") return tier.price_cents;
    return billingPeriod === "yearly" ? tier.yearly_price_cents : tier.price_cents;
  };

  const isEnterprise = (planId: string) => planId === "enterprise";
  const isBusiness = (planId: string) => planId === "business";

  return (
    <section id="pricing" className="py-24 lg:py-32 relative bg-muted/30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-3xl mx-auto mb-12"
        >
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-lg text-muted-foreground">
            Plans that grow with your business. No hidden fees.
          </p>
        </motion.div>

        {/* Billing Toggle */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex justify-center mb-12"
        >
          <BillingToggle value={billingPeriod} onChange={setBillingPeriod} discountPercent={25} />
        </motion.div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {/* Pricing Cards */}
        {!isLoading && tiers && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 max-w-7xl mx-auto">
            {tiers.map((tier, index) => (
              <motion.div
                key={tier.plan_id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.08 }}
                className="relative flex flex-col"
              >
                <div className={`flex-1 flex flex-col rounded-2xl p-5 transition-all ${
                  tier.is_popular
                    ? "bg-primary text-primary-foreground ring-2 ring-primary shadow-lg scale-[1.02]"
                    : isBusiness(tier.plan_id)
                    ? "bg-card border-2 border-accent"
                    : "bg-card border border-border"
                }`}>
                  {/* Popular Badge */}
                  {tier.is_popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="inline-block px-3 py-1 rounded-full bg-accent text-accent-foreground text-xs font-semibold">
                        Most Popular
                      </span>
                    </div>
                  )}

                  {/* Best for High Volume Badge */}
                  {isBusiness(tier.plan_id) && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="inline-block px-3 py-1 rounded-full bg-accent text-accent-foreground text-xs font-semibold whitespace-nowrap">
                        Best for High Volume
                      </span>
                    </div>
                  )}

                  {/* Plan Header */}
                  <div className="mb-4 mt-2">
                    <h3 className={`font-display font-semibold text-lg mb-1 ${
                      tier.is_popular ? "text-primary-foreground" : "text-foreground"
                    }`}>
                      {tier.name}
                    </h3>
                    <p className={`text-sm ${
                      tier.is_popular ? "text-primary-foreground/80" : "text-muted-foreground"
                    }`}>
                      {tier.description}
                    </p>
                  </div>

                  {/* Price */}
                  <div className="mb-5">
                    {isEnterprise(tier.plan_id) ? (
                      <div className={`font-display text-2xl font-bold ${
                        tier.is_popular ? "text-primary-foreground" : "text-foreground"
                      }`}>
                        Custom
                      </div>
                    ) : (
                      <>
                        <div className="flex items-baseline gap-1">
                          <span className={`font-display text-3xl font-bold ${
                            tier.is_popular ? "text-primary-foreground" : "text-foreground"
                          }`}>
                            ${formatPrice(getDisplayPrice(tier))}
                          </span>
                          <span className={`text-sm ${
                            tier.is_popular ? "text-primary-foreground/70" : "text-muted-foreground"
                          }`}>
                            /mo
                          </span>
                        </div>
                        {billingPeriod === "yearly" && (
                          <p className={`text-xs mt-1 ${
                            tier.is_popular ? "text-primary-foreground/70" : "text-muted-foreground"
                          }`}>
                            billed annually
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="space-y-2.5 mb-5 flex-1">
                    {tier.features.map((feature: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          tier.is_popular ? "bg-primary-foreground/20" : "bg-success/10"
                        }`}>
                          <Check className={`w-2.5 h-2.5 ${
                            tier.is_popular ? "text-primary-foreground" : "text-success"
                          }`} />
                        </div>
                        <span className={`text-sm ${
                          tier.is_popular ? "text-primary-foreground/90" : "text-foreground"
                        }`}>
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <Button 
                    variant={tier.is_popular ? "secondary" : isEnterprise(tier.plan_id) ? "outline" : "default"}
                    size="sm"
                    className={`w-full ${tier.is_popular ? "bg-primary-foreground text-primary hover:bg-primary-foreground/90" : ""}`}
                    asChild
                  >
                    <Link to={isEnterprise(tier.plan_id) ? "mailto:sales@answerafter.com" : "/auth?signup=true"}>
                      {isEnterprise(tier.plan_id) ? "Contact Sales" : "Get Started"}
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </Link>
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Extra Credits Note */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-12 text-center max-w-2xl mx-auto"
        >
          <div className="bg-card border border-border rounded-xl p-6">
            <h4 className="font-semibold text-foreground mb-2">Need more usage?</h4>
            <p className="text-muted-foreground text-sm">
              Additional credits available at $10 for 150 credits. Purchase anytime from your dashboard.
            </p>
          </div>
        </motion.div>

        {/* Bottom Note */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-8 text-center"
        >
          <p className="text-muted-foreground text-sm">
            All plans include 24/7 AI call answering and appointment booking.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
