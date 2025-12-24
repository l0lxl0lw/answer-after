import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SYNC-STRIPE] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase credentials");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all active subscription tiers
    const { data: tiers, error: tiersError } = await supabase
      .from("subscription_tiers")
      .select("*")
      .eq("is_active", true)
      .order("display_order");

    if (tiersError) throw new Error(`Failed to fetch tiers: ${tiersError.message}`);
    
    logStep("Fetched subscription tiers", { count: tiers?.length });

    const results: any[] = [];

    for (const tier of tiers || []) {
      // Skip enterprise (contact sales)
      if (tier.plan_id === "enterprise") {
        logStep("Skipping enterprise tier (contact sales)");
        results.push({ plan_id: tier.plan_id, status: "skipped", reason: "contact sales" });
        continue;
      }

      logStep(`Processing tier: ${tier.name}`, { plan_id: tier.plan_id });

      // Check if product already exists by looking up by metadata
      let product: Stripe.Product | null = null;
      
      const existingProducts = await stripe.products.search({
        query: `metadata['plan_id']:'${tier.plan_id}'`,
      });

      if (existingProducts.data.length > 0) {
        product = existingProducts.data[0];
        logStep(`Found existing product`, { productId: product.id });
        
        // Update product if name changed
        if (product.name !== tier.name) {
          product = await stripe.products.update(product.id, {
            name: tier.name,
            description: tier.description,
          });
          logStep(`Updated product name`);
        }
      } else {
        // Create new product
        product = await stripe.products.create({
          name: tier.name,
          description: tier.description,
          metadata: {
            plan_id: tier.plan_id,
            credits: tier.credits.toString(),
          },
        });
        logStep(`Created new product`, { productId: product.id });
      }

      // Handle monthly price
      let monthlyPriceId = tier.stripe_monthly_price_id;
      if (!monthlyPriceId && tier.price_cents > 0) {
        // Check for existing price
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
          logStep(`Found existing monthly price`, { priceId: monthlyPriceId });
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
          logStep(`Created monthly price`, { priceId: monthlyPriceId, amount: tier.price_cents });
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

        // Yearly price is per month but billed yearly (yearly_price_cents is monthly rate when paid yearly)
        const yearlyAmount = tier.yearly_price_cents * 12; // Total yearly amount
        
        const existingYearly = existingPrices.data.find(
          (p: Stripe.Price) => p.recurring?.interval === 'year' && p.unit_amount === yearlyAmount
        );

        if (existingYearly) {
          yearlyPriceId = existingYearly.id;
          logStep(`Found existing yearly price`, { priceId: yearlyPriceId });
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
          logStep(`Created yearly price`, { priceId: yearlyPriceId, amount: yearlyAmount });
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
        logStep(`Error updating tier`, { error: updateError.message });
        results.push({ 
          plan_id: tier.plan_id, 
          status: "error", 
          error: updateError.message 
        });
      } else {
        logStep(`Updated tier with Stripe IDs`, { 
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

    logStep("Sync complete", { results });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Stripe products synced successfully",
        results 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
