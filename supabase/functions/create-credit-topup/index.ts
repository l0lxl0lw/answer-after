import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createAnonClient, createServiceClient } from "../_shared/db.ts";
import { corsPreflightResponse, errorResponse, successResponse } from "../_shared/errors.ts";
import { createLogger } from "../_shared/logger.ts";
import { config } from "../_shared/config.ts";

const logger = createLogger('create-credit-topup');

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return corsPreflightResponse();
  }

  try {
    const log = logger.withContext({ requestId: crypto.randomUUID() });
    log.step("Function started");

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

    const supabaseAnon = createAnonClient();
    const supabaseAdmin = createServiceClient();

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseAnon.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    log.info("User authenticated", { userId: user.id, email: user.email });

    // Get credit config
    const { data: creditConfig, error: configError } = await supabaseAdmin
      .from('credit_config')
      .select('config_key, config_value')
      .in('config_key', ['topup_credits_amount', 'topup_price_cents']);

    if (configError) throw new Error(`Failed to get config: ${configError.message}`);

    const configMap = Object.fromEntries(creditConfig.map(c => [c.config_key, Number(c.config_value)]));
    const creditsAmount = configMap['topup_credits_amount'] || 300;
    const priceCents = configMap['topup_price_cents'] || 1000;

    log.info("Credit config loaded", { creditsAmount, priceCents });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Check if Stripe customer exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;

    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      log.info("Found existing customer", { customerId });
    } else {
      const newCustomer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      customerId = newCustomer.id;
      log.info("Created new customer", { customerId });
    }

    const origin = req.headers.get("origin") || "https://ppfynksalwrdqhyrxqzs.lovableproject.com";

    // Create one-time payment checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'AnswerAfter Credit Top-Up',
              description: `${creditsAmount} additional credits - never expire`,
            },
            unit_amount: priceCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/dashboard/subscriptions?topup=success&credits=${creditsAmount}`,
      cancel_url: `${origin}/dashboard/subscriptions?topup=cancelled`,
      metadata: {
        supabase_user_id: user.id,
        credits_amount: creditsAmount.toString(),
        type: 'credit_topup',
      },
    });

    log.info("Checkout session created", { sessionId: session.id, url: session.url });

    return successResponse({ url: session.url });

  } catch (error) {
    logger.error("Handler error", error as Error);
    return errorResponse(error as Error);
  }
});
