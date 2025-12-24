import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  try {
    logStep("Webhook received");

    // Handle empty or missing body
    const body = await req.text();
    if (!body || body.trim() === "") {
      logStep("Empty body received, ignoring");
      return new Response(JSON.stringify({ received: true, message: "Empty body ignored" }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Verify webhook signature for security
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      logStep("Missing stripe-signature header");
      return new Response(JSON.stringify({ error: "Missing signature" }), {
        headers: { "Content-Type": "application/json" },
        status: 400,
      });
    }

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
      logStep("Webhook signature verified");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logStep("Webhook signature verification failed", { error: errorMessage });
      return new Response(JSON.stringify({ error: "Webhook signature verification failed" }), {
        headers: { "Content-Type": "application/json" },
        status: 400,
      });
    }

    logStep("Processing event", { type: event.type });

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        logStep("Checkout session completed", { sessionId: session.id, customerId: session.customer });

        // Get customer email and metadata
        const customerId = session.customer as string;
        const customer = await stripe.customers.retrieve(customerId);
        
        if (customer.deleted || !('email' in customer) || !customer.email) {
          logStep("Customer has no email, skipping");
          break;
        }

        // Find the profile by email to get organization_id
        const { data: profile, error: profileError } = await supabaseClient
          .from("profiles")
          .select("organization_id")
          .eq("email", customer.email)
          .single();

        if (profileError || !profile?.organization_id) {
          logStep("Profile not found for checkout", { email: customer.email, error: profileError });
          break;
        }

        const organizationId = profile.organization_id;

        // Determine plan from metadata or price
        const planFromMetadata = session.metadata?.plan || 'core';
        
        logStep("Triggering onboarding flow", { organizationId, plan: planFromMetadata });

        // Trigger the onboarding flow
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

        try {
          const onboardingResponse = await fetch(`${SUPABASE_URL}/functions/v1/run-onboarding`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({
              organizationId: organizationId,
              subscriptionPlan: planFromMetadata,
            }),
          });

          const onboardingResult = await onboardingResponse.json();
          logStep("Onboarding result", onboardingResult);

          if (!onboardingResult.success) {
            logStep("Onboarding had issues", { steps: onboardingResult.steps });
          }
        } catch (onboardingError) {
          logStep("Onboarding error (non-fatal)", { error: String(onboardingError) });
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        
        // Get customer email to find organization
        const customer = await stripe.customers.retrieve(customerId);
        if (customer.deleted || !('email' in customer) || !customer.email) {
          logStep("Customer has no email, skipping");
          break;
        }

        // Find the profile by email to get organization_id
        const { data: profile, error: profileError } = await supabaseClient
          .from("profiles")
          .select("organization_id")
          .eq("email", customer.email)
          .single();

        if (profileError || !profile?.organization_id) {
          logStep("Profile not found", { email: customer.email, error: profileError });
          break;
        }

        const organizationId = profile.organization_id;

        // Determine subscription status and plan from price metadata
        let status = subscription.status;
        if (subscription.status === "trialing") {
          status = "trialing";
        } else if (subscription.status === "active") {
          status = "active";
        }

        // Get plan from subscription item price metadata
        let plan = "core";
        const priceId = subscription.items.data[0]?.price?.id;
        if (priceId) {
          const price = await stripe.prices.retrieve(priceId);
          plan = (price.metadata?.plan_id) || "core";
        }

        // Update or insert subscription in database
        const { error: upsertError } = await supabaseClient
          .from("subscriptions")
          .upsert({
            organization_id: organizationId,
            stripe_subscription_id: subscription.id,
            stripe_customer_id: customerId,
            plan: plan,
            status: status,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
          }, {
            onConflict: "organization_id",
          });

        if (upsertError) {
          logStep("Error upserting subscription", { error: upsertError });
        } else {
          logStep("Subscription synced", { organizationId, status, plan, subscriptionId: subscription.id });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const customer = await stripe.customers.retrieve(customerId);
        if (customer.deleted || !('email' in customer) || !customer.email) {
          logStep("Customer has no email, skipping");
          break;
        }

        const { data: profile } = await supabaseClient
          .from("profiles")
          .select("organization_id")
          .eq("email", customer.email)
          .single();

        if (profile?.organization_id) {
          await supabaseClient
            .from("subscriptions")
            .update({ status: "cancelled" })
            .eq("organization_id", profile.organization_id);

          logStep("Subscription cancelled", { organizationId: profile.organization_id });
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.billing_reason === "subscription_cycle") {
          logStep("Recurring payment succeeded", { invoiceId: invoice.id });
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        
        const customer = await stripe.customers.retrieve(customerId);
        if (customer.deleted || !('email' in customer) || !customer.email) break;

        const { data: profile } = await supabaseClient
          .from("profiles")
          .select("organization_id")
          .eq("email", customer.email)
          .single();

        if (profile?.organization_id) {
          await supabaseClient
            .from("subscriptions")
            .update({ status: "past_due" })
            .eq("organization_id", profile.organization_id);

          logStep("Payment failed - marked past_due", { organizationId: profile.organization_id });
        }
        break;
      }

      default:
        logStep("Unhandled event type", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
