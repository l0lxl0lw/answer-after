import { motion } from "framer-motion";
import { 
  Phone, 
  Brain, 
  Calendar, 
  Bell, 
  Settings, 
  Shield,
  Zap,
  BarChart3
} from "lucide-react";

const features = [
  {
    icon: Brain,
    title: "Instant Lead Response",
    description: "Every call answered in seconds. Respond within the critical 5-minute window when leads are 10x more likely to convert.",
  },
  {
    icon: Calendar,
    title: "Smart Scheduling",
    description: "Book appointments automatically while prospects are engaged — before they call your competitor.",
  },
  {
    icon: Settings,
    title: "Persistent Follow-Up",
    description: "Multi-touch sequences via call and text ensure no lead falls through the cracks. 78% of customers choose the first to respond.",
  },
  {
    icon: Bell,
    title: "Real-Time Alerts",
    description: "Get instant notifications for hot leads so you can jump in when it matters most.",
  },
  {
    icon: Zap,
    title: "Speed to Lead",
    description: "Waiting 30 minutes drops conversion by 25%. Our AI responds instantly, 24/7, so you never lose the timing advantage.",
  },
  {
    icon: BarChart3,
    title: "Conversion Analytics",
    description: "See exactly how many leads you're capturing vs. losing. Track your marketing ROI in real-time.",
  },
  {
    icon: Shield,
    title: "Enterprise Security",
    description: "HIPAA-ready compliance, encrypted data, and multi-tenant isolation for complete peace of mind.",
  },
  {
    icon: Phone,
    title: "Works With Your Number",
    description: "Seamless integration with your existing phone system. No complicated setup required.",
  },
];

export function Features() {
  return (
    <section id="features" className="py-24 lg:py-32 relative">
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
            Features
          </span>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold mb-6">
            Stop Wasting Your{" "}
            <span className="text-gradient">Marketing Budget</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            You're spending thousands to make the phone ring. Answer After ensures every lead
            gets an instant response — so your ad spend actually converts to revenue.
          </p>
        </motion.div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="group p-6 rounded-2xl bg-card border border-border hover:border-primary/30 hover:shadow-lg transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-hero flex items-center justify-center mb-4 group-hover:shadow-glow transition-shadow duration-300">
                <feature.icon className="w-6 h-6 text-primary-foreground" />
              </div>
              <h3 className="font-display font-semibold text-lg mb-2">{feature.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
