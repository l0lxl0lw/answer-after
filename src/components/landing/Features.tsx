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
    title: "AI Call Handling",
    description: "Intelligent AI answers calls naturally, understands customer needs, and responds like a trained receptionist.",
  },
  {
    icon: Calendar,
    title: "Smart Scheduling",
    description: "Automatically schedules appointments based on your custom rules, availability, and service requirements.",
  },
  {
    icon: Settings,
    title: "Business Rules Engine",
    description: "Define pricing, duration, emergency protocols, and scheduling constraints for each service you offer.",
  },
  {
    icon: Bell,
    title: "Instant Notifications",
    description: "Get emergency alerts, daily summaries, and call transcripts delivered to your phone or email.",
  },
  {
    icon: Zap,
    title: "Emergency Detection",
    description: "AI identifies urgent vs. routine requests and escalates appropriately based on your protocols.",
  },
  {
    icon: BarChart3,
    title: "Revenue Analytics",
    description: "Track conversion rates, revenue captured, and call volume to measure your ROI.",
  },
  {
    icon: Shield,
    title: "Enterprise Security",
    description: "HIPAA-ready compliance, encrypted data, and multi-tenant isolation for complete peace of mind.",
  },
  {
    icon: Phone,
    title: "Twilio Integration",
    description: "Seamless integration with your existing phone system through Twilio's reliable infrastructure.",
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
            Everything You Need to{" "}
            <span className="text-gradient">Capture Revenue</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            A complete solution for service businesses that want to convert every after-hours 
            call into scheduled appointments and satisfied customers.
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
