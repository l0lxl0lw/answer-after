import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createServiceClient } from "../_shared/db.ts";
import { corsPreflightResponse, errorResponse, successResponse } from "../_shared/errors.ts";
import { createLogger } from "../_shared/logger.ts";
import { config } from "../_shared/config.ts";

const logger = createLogger('customer-portal');

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return corsPreflightResponse();
  }

  try {
    const log = logger.withContext({ requestId: crypto.randomUUID() });
    log.step("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    // Safety check: Ensure we're using test keys in non-production environments
    const isTestKey = stripeKey.startsWith("sk_test_");
    const isLiveKey = stripeKey.startsWith("sk_live_");

    if (!isTestKey && !isLiveKey) {
      throw new Error("Invalid STRIPE_SECRET_KEY format");
    }

    if (config.isLocal && !isTestKey) {
      throw new Error("SAFETY: Local environment requires Stripe test keys (sk_test_*). Live keys are not allowed in local development.");
    }

    log.info("Stripe key verified", { isTestMode: isTestKey, isLocalEnv: config.isLocal });

    const supabaseClient = createServiceClient();

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    log.info("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });

    if (customers.data.length === 0) {
      throw new Error("No Stripe customer found for this user");
    }

    const customerId = customers.data[0].id;
    log.info("Found Stripe customer", { customerId });

    const origin = req.headers.get("origin") || "https://ppfynksalwrdqhyrxqzs.lovableproject.com";
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/dashboard/settings`,
    });
    log.info("Customer portal session created", { sessionId: portalSession.id, url: portalSession.url });

    return successResponse({ url: portalSession.url });

  } catch (error) {
    logger.error("Handler error", error as Error);
    return errorResponse(error as Error);
  }
});
