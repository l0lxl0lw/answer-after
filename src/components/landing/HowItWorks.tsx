import { motion } from "framer-motion";
import { PhoneIncoming, MessageSquare, CalendarCheck, BellRing } from "lucide-react";

const steps = [
  {
    icon: PhoneIncoming,
    step: "01",
    title: "Customer Calls",
    description: "Every incoming call is answered instantly by your AI receptionist — 24 hours a day, 7 days a week.",
  },
  {
    icon: MessageSquare,
    step: "02",
    title: "AI Conversation",
    description: "Our AI engages naturally, understanding their needs and collecting service details.",
  },
  {
    icon: CalendarCheck,
    step: "03",
    title: "Smart Booking",
    description: "Based on your rules, the AI schedules appointments and confirms with the customer.",
  },
  {
    icon: BellRing,
    step: "04",
    title: "Automated Reminders",
    description: "AI sends reminder calls and texts before appointments, capturing confirmations automatically.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 lg:py-32 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl" />
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-3xl mx-auto mb-16 lg:mb-20"
        >
          <span className="inline-block px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">
            How It Works
          </span>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold mb-6">
            Simple Setup,{" "}
            <span className="text-gradient">Powerful Results</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Get started in minutes and let your AI receptionist handle calls around the clock while you focus on running your business.
          </p>
        </motion.div>

        {/* Steps */}
        <div className="relative">
          {/* Connection Line */}
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-border to-transparent hidden lg:block" />
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.15 }}
                className="relative"
              >
                <div className="flex flex-col items-center text-center">
                  {/* Step Number */}
                  <div className="relative mb-6">
                    <div className="w-20 h-20 rounded-2xl bg-card border-2 border-border flex items-center justify-center shadow-lg relative z-10">
                      <step.icon className="w-8 h-8 text-primary" />
                    </div>
                    <span className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-gradient-hero flex items-center justify-center text-xs font-bold text-primary-foreground shadow-glow">
                      {step.step}
                    </span>
                  </div>
                  
                  <h3 className="font-display font-semibold text-xl mb-3">{step.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
