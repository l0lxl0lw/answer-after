import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createServiceClient } from "../_shared/db.ts";
import { corsPreflightResponse, errorResponse, successResponse } from "../_shared/errors.ts";
import { createLogger } from "../_shared/logger.ts";
import { config } from "../_shared/config.ts";

const logger = createLogger('sync-stripe-products');

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

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const supabase = createServiceClient();

    // Fetch all active subscription tiers
    const { data: tiers, error: tiersError } = await supabase
      .from("subscription_tiers")
      .select("*")
      .eq("is_active", true)
      .order("display_order");

    if (tiersError) throw new Error(`Failed to fetch tiers: ${tiersError.message}`);

    log.info("Fetched subscription tiers", { count: tiers?.length });

    const results: any[] = [];

    for (const tier of tiers || []) {
      // Skip enterprise (contact sales)
      if (tier.plan_id === "enterprise") {
        log.info("Skipping enterprise tier (contact sales)");
        results.push({ plan_id: tier.plan_id, status: "skipped", reason: "contact sales" });
        continue;
      }

      log.info(`Processing tier: ${tier.name}`, { plan_id: tier.plan_id });

      // Check if product already exists by looking up by metadata
      let product: Stripe.Product | null = null;

      const existingProducts = await stripe.products.search({
        query: `metadata['plan_id']:'${tier.plan_id}'`,
      });

      if (existingProducts.data.length > 0) {
        product = existingProducts.data[0];
        log.info("Found existing product", { productId: product.id });

        if (product.name !== tier.name) {
          product = await stripe.products.update(product.id, {
            name: tier.name,
            description: tier.description,
          });
          log.info("Updated product name");
        }
      } else {
        product = await stripe.products.create({
          name: tier.name,
          description: tier.description,
          metadata: {
            plan_id: tier.plan_id,
            credits: tier.credits.toString(),
          },
        });
        log.info("Created new product", { productId: product.id });
      }

      // Handle monthly price
      let monthlyPriceId = tier.stripe_monthly_price_id;
      if (!monthlyPriceId && tier.price_cents > 0) {
        const existingPrices = await stripe.prices.list({
          product: product.id,
          type: 'recurring',
          active: true,
        });

        const existingMonthly = existingPrices.data.find(
          (p: Stripe.Price) => p.recurring?.interval === 'month' && p.unit_amount === tier.price_cents
        );

        if (existingMonthly) {
          monthlyPriceId = existingMonthly.id;
          log.info("Found existing monthly price", { priceId: monthlyPriceId });
        } else {
          const monthlyPrice = await stripe.prices.create({
            product: product.id,
            unit_amount: tier.price_cents,
            currency: 'usd',
            recurring: { interval: 'month' },
            metadata: {
              plan_id: tier.plan_id,
              billing_period: 'monthly',
            },
          });
          monthlyPriceId = monthlyPrice.id;
          log.info("Created monthly price", { priceId: monthlyPriceId, amount: tier.price_cents });
        }
      }

      // Handle yearly price
      let yearlyPriceId = tier.stripe_yearly_price_id;
      if (!yearlyPriceId && tier.yearly_price_cents && tier.yearly_price_cents > 0) {
        const existingPrices = await stripe.prices.list({
          product: product.id,
          type: 'recurring',
          active: true,
        });

        const yearlyAmount = tier.yearly_price_cents * 12;

        const existingYearly = existingPrices.data.find(
          (p: Stripe.Price) => p.recurring?.interval === 'year' && p.unit_amount === yearlyAmount
        );

        if (existingYearly) {
          yearlyPriceId = existingYearly.id;
          log.info("Found existing yearly price", { priceId: yearlyPriceId });
        } else {
          const yearlyPrice = await stripe.prices.create({
            product: product.id,
            unit_amount: yearlyAmount,
            currency: 'usd',
            recurring: { interval: 'year' },
            metadata: {
              plan_id: tier.plan_id,
              billing_period: 'yearly',
              monthly_equivalent: tier.yearly_price_cents.toString(),
            },
          });
          yearlyPriceId = yearlyPrice.id;
          log.info("Created yearly price", { priceId: yearlyPriceId, amount: yearlyAmount });
        }
      }

      // Update subscription_tiers with Stripe IDs
      const { error: updateError } = await supabase
        .from("subscription_tiers")
        .update({
          stripe_monthly_price_id: monthlyPriceId,
          stripe_yearly_price_id: yearlyPriceId,
        })
        .eq("id", tier.id);

      if (updateError) {
        log.error("Error updating tier", updateError);
        results.push({
          plan_id: tier.plan_id,
          status: "error",
          error: updateError.message
        });
      } else {
        log.info("Updated tier with Stripe IDs", {
          plan_id: tier.plan_id,
          monthlyPriceId,
          yearlyPriceId
        });
        results.push({
          plan_id: tier.plan_id,
          status: "success",
          product_id: product.id,
          monthly_price_id: monthlyPriceId,
          yearly_price_id: yearlyPriceId,
        });
      }
    }

    log.info("Sync complete", { results });

    return successResponse({
      success: true,
      message: "Stripe products synced successfully",
      results
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Handler error", new Error(errorMessage));
    return errorResponse(errorMessage, 500);
  }
});
