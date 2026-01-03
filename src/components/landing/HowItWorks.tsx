import { motion } from "framer-motion";
import { PhoneIncoming, MessageSquare, CalendarCheck, BellRing } from "lucide-react";

const steps = [
  {
    icon: PhoneIncoming,
    step: "01",
    title: "Lead Calls In",
    description: "Every call answered instantly — within seconds, not minutes. 85% of callers won't try again if you miss them.",
  },
  {
    icon: MessageSquare,
    step: "02",
    title: "Instant Engagement",
    description: "AI engages the prospect immediately, gathering their needs while they're most interested in buying.",
  },
  {
    icon: CalendarCheck,
    step: "03",
    title: "Book While Hot",
    description: "Schedule appointments on the spot. Leads contacted within 5 minutes are 10x more likely to convert.",
  },
  {
    icon: BellRing,
    step: "04",
    title: "Persistent Follow-Up",
    description: "Automated reminders and follow-ups keep leads engaged until they convert — no prospect left behind.",
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
            From Missed Call to{" "}
            <span className="text-gradient">Booked Appointment</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Set up in minutes. Start capturing leads that would've gone to your competitors while you were busy or after hours.
          </p>
        </motion.div>

        {/* Steps */}
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
                <div className="w-16 h-16 rounded-2xl bg-card border border-border flex items-center justify-center mb-5">
                  <step.icon className="w-7 h-7 text-primary" />
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
    </section>
  );
}
