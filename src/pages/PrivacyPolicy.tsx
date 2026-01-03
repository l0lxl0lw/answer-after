import { Link } from "react-router-dom";
import { ArrowLeft, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CONTACT, COMPANY } from "@/lib/constants";

export default function PrivacyPolicy() {
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
        <h1 className="font-display text-4xl font-bold mb-8">Privacy Policy</h1>
        <p className="text-muted-foreground mb-8">Last updated: December 25, 2025</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="font-display text-2xl font-semibold mb-4">1. Introduction</h2>
            <p className="text-muted-foreground leading-relaxed">
              Answer After ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our AI-powered lead capture and call handling service.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold mb-4">2. Information We Collect</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">We collect information in the following ways:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li><strong>Account Information:</strong> Name, email address, phone number, and business details when you create an account.</li>
              <li><strong>Call Data:</strong> Call recordings, transcripts, caller information, and appointment details processed through our service.</li>
              <li><strong>Usage Data:</strong> Information about how you interact with our service, including log data and analytics.</li>
              <li><strong>Payment Information:</strong> Billing details processed securely through our payment providers.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold mb-4">3. How We Use Your Information</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">We use the collected information to:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>Provide and maintain our AI call handling service</li>
              <li>Process and schedule appointments on your behalf</li>
              <li>Send you service-related notifications and updates</li>
              <li>Improve our AI models and service quality</li>
              <li>Process payments and manage your subscription</li>
              <li>Respond to your inquiries and support requests</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold mb-4">4. Data Sharing and Disclosure</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We do not sell your personal information. We may share your information with:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li><strong>Service Providers:</strong> Third-party vendors who assist in operating our service (e.g., cloud hosting, payment processing).</li>
              <li><strong>Legal Requirements:</strong> When required by law or to protect our rights and safety.</li>
              <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold mb-4">5. Data Security</h2>
            <p className="text-muted-foreground leading-relaxed">
              We implement industry-standard security measures to protect your information, including encryption in transit and at rest, access controls, and regular security audits. However, no method of transmission over the Internet is 100% secure.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold mb-4">6. Data Retention</h2>
            <p className="text-muted-foreground leading-relaxed">
              We retain your information for as long as your account is active or as needed to provide services. Call recordings and transcripts are retained according to your subscription plan settings. You may request deletion of your data at any time.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold mb-4">7. Your Rights</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">Depending on your location, you may have the right to:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>Access and receive a copy of your personal data</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Object to or restrict processing of your data</li>
              <li>Data portability</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold mb-4">8. HIPAA Compliance</h2>
            <p className="text-muted-foreground leading-relaxed">
              For healthcare-related businesses, Answer After offers HIPAA-compliant plans with additional safeguards including Business Associate Agreements (BAA), enhanced encryption, and audit logging.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold mb-4">9. Children's Privacy</h2>
            <p className="text-muted-foreground leading-relaxed">
              Our service is not intended for individuals under 18 years of age. We do not knowingly collect personal information from children.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold mb-4">10. Changes to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the "Last updated" date.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold mb-4">11. Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have questions about this Privacy Policy, please contact us at:
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
