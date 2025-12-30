import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createServiceClient } from "../_shared/db.ts";
import { corsPreflightResponse, errorResponse, successResponse } from "../_shared/errors.ts";
import { createLogger } from "../_shared/logger.ts";

const logger = createLogger('send-trial-reminder');

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return corsPreflightResponse();
  }

  try {
    const log = logger.withContext({ requestId: crypto.randomUUID() });
    log.step("Function started - checking for trials ending in 3 days");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const resendKey = Deno.env.get("RESEND_API_KEY");

    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    if (!resendKey) throw new Error("RESEND_API_KEY is not set");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const resend = new Resend(resendKey);
    const supabaseClient = createServiceClient();

    // Get all trialing subscriptions
    const subscriptions = await stripe.subscriptions.list({
      status: "trialing",
      limit: 100,
    });

    log.info("Found trialing subscriptions", { count: subscriptions.data.length });

    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const threeDaysFromNowStart = new Date(threeDaysFromNow.setHours(0, 0, 0, 0));
    const threeDaysFromNowEnd = new Date(threeDaysFromNow.setHours(23, 59, 59, 999));

    let emailsSent = 0;

    for (const subscription of subscriptions.data) {
      if (!subscription.trial_end) continue;

      const trialEnd = new Date(subscription.trial_end * 1000);

      // Check if trial ends exactly 3 days from now (within the day)
      if (trialEnd >= threeDaysFromNowStart && trialEnd <= threeDaysFromNowEnd) {
        const customer = await stripe.customers.retrieve(subscription.customer as string);

        if (customer.deleted || !('email' in customer) || !customer.email) {
          log.info("Skipping - no email for customer", { customerId: subscription.customer });
          continue;
        }

        const trialEndFormatted = trialEnd.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });

        const emailResponse = await resend.emails.send({
          from: "AnswerAfter <onboarding@resend.dev>",
          to: [customer.email],
          subject: "Your AnswerAfter trial ends in 3 days",
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 24px;">Your Trial is Ending Soon</h1>
              </div>

              <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0; border-top: none;">
                <p style="font-size: 16px; margin-top: 0;">Hi there,</p>

                <p style="font-size: 16px;">Your 30-day free trial of <strong>AnswerAfter</strong> will end on <strong>${trialEndFormatted}</strong>.</p>

                <p style="font-size: 16px;">After your trial ends, you'll automatically be upgraded to the Starter plan at <strong>$99/month</strong>. No action is needed - your service will continue uninterrupted.</p>

                <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin: 24px 0;">
                  <h3 style="margin-top: 0; color: #16a34a;">What you're getting:</h3>
                  <ul style="padding-left: 20px;">
                    <li>24/7 AI-powered call answering</li>
                    <li>Appointment scheduling</li>
                    <li>Emergency dispatch</li>
                    <li>Call transcripts & recordings</li>
                    <li>Real-time notifications</li>
                  </ul>
                </div>

                <p style="font-size: 16px;">If you'd like to make any changes to your subscription, you can do so anytime from your dashboard settings.</p>

                <p style="font-size: 16px;">Thanks for choosing AnswerAfter!</p>

                <p style="font-size: 14px; color: #64748b; margin-bottom: 0;">- The AnswerAfter Team</p>
              </div>
            </body>
            </html>
          `,
        });

        log.info("Email sent", { email: customer.email, subscriptionId: subscription.id });
        emailsSent++;
      }
    }

    log.info("Completed", { emailsSent });

    return successResponse({ success: true, emailsSent });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Handler error", new Error(errorMessage));
    return errorResponse(errorMessage, 500);
  }
});
