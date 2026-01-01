import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createAnonClient, createServiceClient } from "../_shared/db.ts";
import { corsPreflightResponse, errorResponse, successResponse } from "../_shared/errors.ts";
import { createLogger } from "../_shared/logger.ts";
import { config } from "../_shared/config.ts";

const logger = createLogger('create-credit-topup');

// Package definitions with fallback defaults
const TOPUP_PACKAGES = {
  basic: { credits: 300, priceCents: 500, label: '5 minutes' },
  value: { credits: 1000, priceCents: 1500, label: '17 minutes' },
  bulk: { credits: 3000, priceCents: 4000, label: '50 minutes' },
} as const;

type PackageId = keyof typeof TOPUP_PACKAGES;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return corsPreflightResponse();
  }

  try {
    const log = logger.withContext({ requestId: crypto.randomUUID() });
    log.step("Function started");

    // Parse request body for package selection
    let packageId: PackageId = 'basic';
    try {
      const body = await req.json();
      if (body.package && body.package in TOPUP_PACKAGES) {
        packageId = body.package as PackageId;
      }
    } catch {
      // No body or invalid JSON - use default package
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

    const supabaseAnon = createAnonClient();
    const supabaseAdmin = createServiceClient();

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseAnon.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    log.info("User authenticated", { userId: user.id, email: user.email });

    // Get credit config from database (with fallbacks to hardcoded defaults)
    const configKeys = [
      `topup_${packageId}_credits`,
      `topup_${packageId}_price_cents`,
    ];

    const { data: creditConfig } = await supabaseAdmin
      .from('credit_config')
      .select('config_key, config_value')
      .in('config_key', configKeys);

    const configMap = Object.fromEntries(
      (creditConfig || []).map(c => [c.config_key, Number(c.config_value)])
    );

    // Use database config or fallback to hardcoded defaults
    const pkg = TOPUP_PACKAGES[packageId];
    const creditsAmount = configMap[`topup_${packageId}_credits`] || pkg.credits;
    const priceCents = configMap[`topup_${packageId}_price_cents`] || pkg.priceCents;

    log.info("Credit config loaded", { packageId, creditsAmount, priceCents });

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
    const packageLabel = pkg.label;
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `AnswerAfter Credits - ${packageLabel}`,
              description: `${creditsAmount.toLocaleString()} credits (~${packageLabel}) - never expire`,
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
        package_id: packageId,
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
