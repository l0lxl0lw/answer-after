import { Link } from "react-router-dom";
import { ArrowLeft, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CONTACT, COMPANY } from "@/lib/constants";

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-hero">
                <Phone className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-display font-bold text-xl">
                Answer<span className="text-gradient">After</span>
              </span>
            </Link>
            <Button variant="ghost" asChild>
              <Link to="/" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to Home
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 max-w-4xl">
        <h1 className="font-display text-4xl font-bold mb-8">Terms of Service</h1>
        <p className="text-muted-foreground mb-8">Last updated: December 25, 2025</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="font-display text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              By accessing or using Answer After's AI-powered after-hours call handling service ("Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you may not use the Service.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold mb-4">2. Description of Service</h2>
            <p className="text-muted-foreground leading-relaxed">
              Answer After provides an AI-powered call handling service that answers calls on behalf of your business during after-hours periods, schedules appointments, and manages customer inquiries. The Service includes voice AI technology, appointment scheduling, and integration with your business systems.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold mb-4">3. Account Registration</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">To use the Service, you must:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>Create an account with accurate and complete information</li>
              <li>Maintain the security of your account credentials</li>
              <li>Be at least 18 years of age</li>
              <li>Have the authority to bind your business to these Terms</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              You are responsible for all activities that occur under your account.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold mb-4">4. Subscription and Payment</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              The Service is provided on a subscription basis. By subscribing, you agree to:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>Pay all fees associated with your chosen subscription plan</li>
              <li>Provide valid payment information</li>
              <li>Authorize recurring charges according to your billing cycle</li>
              <li>Pay for any additional usage beyond your plan limits</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              Subscription fees are non-refundable except as required by law or as explicitly stated in these Terms.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold mb-4">5. Acceptable Use</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">You agree not to use the Service to:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>Violate any applicable laws or regulations</li>
              <li>Transmit harmful, fraudulent, or deceptive content</li>
              <li>Interfere with or disrupt the Service or servers</li>
              <li>Attempt to gain unauthorized access to any systems</li>
              <li>Use the Service for any illegal telemarketing or spam purposes</li>
              <li>Impersonate any person or entity</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold mb-4">6. AI and Call Handling</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              You acknowledge and agree that:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>The Service uses artificial intelligence to handle calls, which may occasionally produce errors or misunderstandings</li>
              <li>You are responsible for reviewing AI-scheduled appointments and call summaries</li>
              <li>You will inform callers that they may be interacting with an AI system where required by law</li>
              <li>Call recordings and transcripts are stored according to your subscription plan and our Privacy Policy</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold mb-4">7. Intellectual Property</h2>
            <p className="text-muted-foreground leading-relaxed">
              The Service, including all software, AI models, designs, and content, is owned by Answer After and protected by intellectual property laws. You are granted a limited, non-exclusive license to use the Service for your business purposes. You may not copy, modify, distribute, or reverse engineer any part of the Service.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold mb-4">8. Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, ANSWER AFTER SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, OR BUSINESS OPPORTUNITIES. OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT YOU PAID FOR THE SERVICE IN THE TWELVE MONTHS PRECEDING THE CLAIM.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold mb-4">9. Disclaimer of Warranties</h2>
            <p className="text-muted-foreground leading-relaxed">
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. WE DO NOT GUARANTEE THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR COMPLETELY SECURE.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold mb-4">10. Termination</h2>
            <p className="text-muted-foreground leading-relaxed">
              Either party may terminate this agreement at any time. You may cancel your subscription through your account settings. We may suspend or terminate your access for violation of these Terms. Upon termination, your right to use the Service ceases, and we may delete your data according to our data retention policies.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold mb-4">11. Changes to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may modify these Terms at any time. We will notify you of material changes via email or through the Service. Continued use of the Service after changes constitutes acceptance of the modified Terms.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold mb-4">12. Governing Law</h2>
            <p className="text-muted-foreground leading-relaxed">
              These Terms are governed by the laws of the State of Delaware, United States, without regard to conflict of law principles. Any disputes shall be resolved in the courts of Delaware.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold mb-4">13. Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have questions about these Terms of Service, please contact us at:
            </p>
            <p className="text-muted-foreground mt-2">
              Email: {CONTACT.general}
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8 mt-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} {COMPANY.name}. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
