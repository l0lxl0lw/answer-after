import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Zap, Check, X } from "lucide-react";
import { COMPANY } from "@/lib/constants";

export default function UpgradePrompt() {
  const navigate = useNavigate();

  const handleSkip = () => {
    navigate("/onboarding/setup-services");
  };

  const handleUpgrade = () => {
    navigate("/dashboard/subscriptions");
  };

  const features = {
    free: [
      "AI phone answering",
      "Basic appointment booking",
      "Call transcripts",
      "250 credits/month (~83 calls)",
    ],
    pro: [
      "Everything in Free",
      "1,000 credits/month (~333 calls)",
      "Custom greeting audio",
      "Advanced analytics",
      "Priority support",
      "Multiple phone numbers",
    ],
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
            Unlock advanced features and handle more calls with our Pro plan. Upgrade now or continue with the free plan.
          </p>
        </motion.div>

        {/* Comparison Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Free Plan */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card border rounded-xl p-6"
          >
            <div className="mb-4">
              <h3 className="font-display text-xl font-bold mb-1">Core Plan</h3>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">Free</span>
                <span className="text-muted-foreground text-sm">forever</span>
              </div>
            </div>

            <ul className="space-y-3">
              {features.free.map((feature, idx) => (
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
              Continue with Core
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </motion.div>

          {/* Pro Plan */}
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
              <h3 className="font-display text-xl font-bold mb-1">Pro Plan</h3>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">$49</span>
                <span className="text-muted-foreground text-sm">/month</span>
              </div>
            </div>

            <ul className="space-y-3">
              {features.pro.map((feature, idx) => (
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
              Upgrade to Pro
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
