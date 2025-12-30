import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createServiceClient } from "../_shared/db.ts";
import { createLogger } from "../_shared/logger.ts";
import { config } from "../_shared/config.ts";

const logger = createLogger('stripe-webhook');

serve(async (req) => {
  try {
    const log = logger.withContext({ requestId: crypto.randomUUID() });
    log.step("Webhook received");

    // Handle empty or missing body
    const body = await req.text();
    if (!body || body.trim() === "") {
      log.info("Empty body received, ignoring");
      return new Response(JSON.stringify({ received: true, message: "Empty body ignored" }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const isTestKey = stripeKey.startsWith("sk_test_");
    const isLiveKey = stripeKey.startsWith("sk_live_");

    if (!isTestKey && !isLiveKey) {
      throw new Error("Invalid STRIPE_SECRET_KEY format");
    }

    if (config.isLocal && !isTestKey) {
      throw new Error("SAFETY: Local environment requires Stripe test keys (sk_test_*). Live keys are not allowed in local development.");
    }

    log.info("Stripe key verified", { isTestMode: isTestKey, isLocalEnv: config.isLocal });

    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const supabaseClient = createServiceClient();

    // Verify webhook signature for security
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      log.warn("Missing stripe-signature header");
      return new Response(JSON.stringify({ error: "Missing signature" }), {
        headers: { "Content-Type": "application/json" },
        status: 400,
      });
    }

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
      log.info("Webhook signature verified");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      log.error("Webhook signature verification failed", new Error(errorMessage));
      return new Response(JSON.stringify({ error: "Webhook signature verification failed" }), {
        headers: { "Content-Type": "application/json" },
        status: 400,
      });
    }

    log.info("Processing event", { type: event.type });

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        log.info("Checkout session completed", { sessionId: session.id, customerId: session.customer });

        const customerId = session.customer as string;
        const customer = await stripe.customers.retrieve(customerId);

        if (customer.deleted || !('email' in customer) || !customer.email) {
          log.info("Customer has no email, skipping");
          break;
        }

        const { data: profile, error: profileError } = await supabaseClient
          .from("profiles")
          .select("organization_id")
          .eq("email", customer.email)
          .single();

        if (profileError || !profile?.organization_id) {
          log.warn("Profile not found for checkout", { email: customer.email, error: profileError });
          break;
        }

        const organizationId = profile.organization_id;

        // Check if this is a credit top-up purchase
        if (session.metadata?.type === 'credit_topup') {
          const creditsAmount = parseInt(session.metadata?.credits_amount || '300', 10);

          const { error: insertError } = await supabaseClient
            .from("purchased_credits")
            .insert({
              organization_id: organizationId,
              credits_purchased: creditsAmount,
              credits_remaining: creditsAmount,
              price_cents: session.amount_total || 1000,
              stripe_payment_intent_id: session.payment_intent as string,
            });

          if (insertError) {
            log.error("Error inserting purchased credits", insertError);
          } else {
            log.info("Credit top-up recorded", { organizationId, credits: creditsAmount });
          }
          break;
        }

        const planFromMetadata = session.metadata?.plan || 'core';
        log.info("Triggering onboarding flow", { organizationId, plan: planFromMetadata });

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
          log.info("Onboarding result", onboardingResult);

          if (!onboardingResult.success) {
            log.warn("Onboarding had issues", { steps: onboardingResult.steps });
          }
        } catch (onboardingError) {
          log.warn("Onboarding error (non-fatal)", { error: String(onboardingError) });
        }
        break;
      }

      case "customer.subscription.created": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const customer = await stripe.customers.retrieve(customerId);
        if (customer.deleted || !('email' in customer) || !customer.email) {
          log.info("Customer has no email, skipping");
          break;
        }

        const { data: profileCreate, error: profileErrorCreate } = await supabaseClient
          .from("profiles")
          .select("organization_id")
          .eq("email", customer.email)
          .single();

        if (profileErrorCreate || !profileCreate?.organization_id) {
          log.warn("Profile not found", { email: customer.email, error: profileErrorCreate });
          break;
        }

        const organizationIdCreate = profileCreate.organization_id;

        // Check if this is a $1 first month subscription that needs schedule setup
        const switchToRegular = subscription.metadata?.switch_to_regular === 'true';
        const regularPriceId = subscription.metadata?.regular_price_id;

        if (switchToRegular && regularPriceId) {
          log.info("Setting up subscription schedule for $1 promo", {
            subscriptionId: subscription.id,
            regularPriceId
          });

          try {
            const schedule = await stripe.subscriptionSchedules.create({
              from_subscription: subscription.id,
            });

            const currentPhaseEnd = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);

            await stripe.subscriptionSchedules.update(schedule.id, {
              phases: [
                {
                  items: [{ price: subscription.items.data[0].price.id, quantity: 1 }],
                  end_date: currentPhaseEnd,
                },
                {
                  items: [{ price: regularPriceId, quantity: 1 }],
                  iterations: undefined,
                },
              ],
              end_behavior: 'release',
            });

            log.info("Subscription schedule created", {
              scheduleId: schedule.id,
              phaseEndDate: new Date(currentPhaseEnd * 1000).toISOString()
            });
          } catch (scheduleError) {
            log.error("Error creating subscription schedule", scheduleError as Error);
          }
        }

        let statusCreate = subscription.status;
        let planCreate = subscription.metadata?.plan_id;

        if (!planCreate) {
          const priceId = subscription.items.data[0]?.price?.id;
          if (priceId) {
            try {
              const price = await stripe.prices.retrieve(priceId);
              planCreate = price.metadata?.plan_id;
              log.info("Got plan from price metadata", { priceId, plan: planCreate });
            } catch (e) {
              log.warn("Could not retrieve price", { priceId, error: String(e) });
            }
          }
        }

        if (!planCreate) {
          const { data: existingSub } = await supabaseClient
            .from("subscriptions")
            .select("plan")
            .eq("organization_id", organizationIdCreate)
            .maybeSingle();

          if (existingSub?.plan && existingSub.plan !== 'core') {
            planCreate = existingSub.plan;
            log.info("Preserving existing plan", { plan: planCreate });
          }
        }

        planCreate = planCreate || "core";

        // Safely convert timestamps to ISO strings
        const periodStart = subscription.current_period_start
          ? new Date(subscription.current_period_start * 1000).toISOString()
          : new Date().toISOString();
        const periodEnd = subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // Default 30 days

        const { error: upsertErrorCreate } = await supabaseClient
          .from("subscriptions")
          .upsert({
            organization_id: organizationIdCreate,
            stripe_subscription_id: subscription.id,
            stripe_customer_id: customerId,
            plan: planCreate,
            status: statusCreate,
            current_period_start: periodStart,
            current_period_end: periodEnd,
            cancel_at_period_end: subscription.cancel_at_period_end,
          }, {
            onConflict: "organization_id",
          });

        if (upsertErrorCreate) {
          log.error("Error upserting subscription", upsertErrorCreate);
        } else {
          log.info("Subscription synced", { organizationId: organizationIdCreate, status: statusCreate, plan: planCreate });
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const customer = await stripe.customers.retrieve(customerId);
        if (customer.deleted || !('email' in customer) || !customer.email) {
          log.info("Customer has no email, skipping");
          break;
        }

        const { data: profile, error: profileError } = await supabaseClient
          .from("profiles")
          .select("organization_id")
          .eq("email", customer.email)
          .single();

        if (profileError || !profile?.organization_id) {
          log.warn("Profile not found", { email: customer.email, error: profileError });
          break;
        }

        const organizationId = profile.organization_id;

        let status = subscription.status;
        let plan = subscription.metadata?.plan_id;

        if (!plan) {
          const priceId = subscription.items.data[0]?.price?.id;
          if (priceId) {
            try {
              const price = await stripe.prices.retrieve(priceId);
              plan = price.metadata?.plan_id;
              log.info("Got plan from price metadata", { priceId, plan });
            } catch (e) {
              log.warn("Could not retrieve price", { priceId, error: String(e) });
            }
          }
        }

        if (!plan) {
          const { data: existingSub } = await supabaseClient
            .from("subscriptions")
            .select("plan")
            .eq("organization_id", organizationId)
            .maybeSingle();

          if (existingSub?.plan && existingSub.plan !== 'core') {
            plan = existingSub.plan;
            log.info("Preserving existing plan", { plan });
          }
        }

        plan = plan || "core";

        // Safely convert timestamps to ISO strings
        const periodStartUpdate = subscription.current_period_start
          ? new Date(subscription.current_period_start * 1000).toISOString()
          : new Date().toISOString();
        const periodEndUpdate = subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

        const { error: upsertError } = await supabaseClient
          .from("subscriptions")
          .upsert({
            organization_id: organizationId,
            stripe_subscription_id: subscription.id,
            stripe_customer_id: customerId,
            plan: plan,
            status: status,
            current_period_start: periodStartUpdate,
            current_period_end: periodEndUpdate,
            cancel_at_period_end: subscription.cancel_at_period_end,
          }, {
            onConflict: "organization_id",
          });

        if (upsertError) {
          log.error("Error upserting subscription", upsertError);
        } else {
          log.info("Subscription synced", { organizationId, status, plan, subscriptionId: subscription.id });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const customer = await stripe.customers.retrieve(customerId);
        if (customer.deleted || !('email' in customer) || !customer.email) {
          log.info("Customer has no email, skipping");
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

          log.info("Subscription cancelled", { organizationId: profile.organization_id });
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.billing_reason === "subscription_cycle") {
          log.info("Recurring payment succeeded", { invoiceId: invoice.id });
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

          log.info("Payment failed - marked past_due", { organizationId: profile.organization_id });
        }
        break;
      }

      default:
        log.info("Unhandled event type", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Handler error", new Error(errorMessage));
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
