import { motion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "How does the AI handle different types of service requests?",
    answer: "Our AI is trained to understand context and intent across various service industries. You configure business rules that define how different services should be handled — including pricing, duration, availability windows, and emergency protocols. The AI follows these rules to provide accurate information and schedule appropriately.",
  },
  {
    question: "What happens if the AI can't handle a call?",
    answer: "When the AI encounters a situation outside its configured parameters (like an unusual request or an angry customer), it gracefully escalates according to your settings. This can include taking a message, transferring to an on-call staff member, or sending you an immediate emergency notification.",
  },
  {
    question: "How long does it take to set up?",
    answer: "Most businesses are up and running within 30 minutes. You'll connect your phone number, configure your services and business rules, and test a few calls. Our onboarding wizard guides you through each step, and our support team is available to help.",
  },
  {
    question: "Can I listen to call recordings?",
    answer: "Yes, all calls are recorded and transcribed (where legally permitted). You can review full transcripts and audio recordings in your dashboard to ensure quality and understand how customers interact with the AI.",
  },
  {
    question: "Is my customer data secure?",
    answer: "Absolutely. We use enterprise-grade encryption for all data in transit and at rest. Our multi-tenant architecture ensures complete isolation between businesses. For healthcare-related clients, we offer HIPAA-compliant configurations.",
  },
  {
    question: "Can I customize the AI's voice and personality?",
    answer: "Yes! You can configure the greeting message, tone of conversation, and responses to match your brand. Enterprise customers can also request custom AI training on their specific terminology and procedures.",
  },
];

export function FAQ() {
  return (
    <section id="faq" className="py-24 lg:py-32 relative">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <span className="inline-block px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">
            FAQ
          </span>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold mb-6">
            Frequently Asked{" "}
            <span className="text-gradient">Questions</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Everything you need to know about Answer After and how it can help your business.
          </p>
        </motion.div>

        {/* FAQ Accordion */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="max-w-3xl mx-auto"
        >
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="bg-card border border-border rounded-2xl px-6 data-[state=open]:shadow-lg transition-shadow"
              >
                <AccordionTrigger className="text-left font-display font-semibold hover:no-underline py-6">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-6 leading-relaxed">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
}
