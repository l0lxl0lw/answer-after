import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT-TRIAL] ${step}${detailsStr}`);
};

// Plan configurations - monthly only
const PLAN_CONFIG: Record<string, { 
  name: string; 
  monthlyPrice: number;
  credits: number;
  description: string;
}> = {
  core: { 
    name: 'Core', 
    monthlyPrice: 2900,  // $29/mo
    credits: 250,
    description: 'AI-powered after-hours call handling'
  },
  growth: { 
    name: 'Growth', 
    monthlyPrice: 9900, // $99/mo
    credits: 600,
    description: 'For growing service businesses'
  },
  pro: { 
    name: 'Pro', 
    monthlyPrice: 19900, // $199/mo
    credits: 1400,
    description: 'For high-volume operations'
  },
  business: { 
    name: 'Business', 
    monthlyPrice: 49900, // $499/mo
    credits: 3000,
    description: 'For multi-location businesses'
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    // Safety check: Ensure we're using test keys in non-production environments
    const isTestKey = stripeKey.startsWith("sk_test_");
    const isLiveKey = stripeKey.startsWith("sk_live_");

    if (!isTestKey && !isLiveKey) {
      throw new Error("Invalid STRIPE_SECRET_KEY format");
    }

    // In local/development, require test keys to prevent accidental charges
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const isLocalEnv = supabaseUrl.includes("localhost") || supabaseUrl.includes("127.0.0.1");

    if (isLocalEnv && !isTestKey) {
      throw new Error("SAFETY: Local environment requires Stripe test keys (sk_test_*). Live keys are not allowed in local development.");
    }

    logStep("Stripe key verified", { isTestMode: isTestKey, isLocalEnv });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Parse request body for plan selection
    let planId = 'growth'; // default plan
    
    try {
      const body = await req.json();
      if (body.planId && PLAN_CONFIG[body.planId]) {
        planId = body.planId;
      }
    } catch {
      // Use defaults
    }

    const planConfig = PLAN_CONFIG[planId];
    logStep("Plan selected", { planId, config: planConfig });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Check if Stripe customer exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Found existing customer", { customerId });
    } else {
      // Create new customer with metadata
      const newCustomer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id,
        },
      });
      customerId = newCustomer.id;
      logStep("Created new customer", { customerId });
    }

    const origin = req.headers.get("origin") || "https://ppfynksalwrdqhyrxqzs.lovableproject.com";

    // Strategy: Use regular monthly price with a coupon that reduces first month to $1
    // This shows: $29/mo with -$28 coupon = $1 due today
    const firstMonthTargetPrice = 100; // $1
    const regularMonthlyPrice = planConfig.monthlyPrice;
    const discountAmount = regularMonthlyPrice - firstMonthTargetPrice; // e.g., $29 - $1 = $28
    
    logStep("Pricing calculated", { 
      firstMonthTargetPrice,
      regularMonthlyPrice,
      discountAmount,
    });

    // Create a product for this plan if it doesn't exist
    const productName = `AnswerAfter ${planConfig.name}`;
    const products = await stripe.products.list({ limit: 100 });
    let product = products.data.find((p: Stripe.Product) => p.name === productName && p.active);
    
    if (!product) {
      product = await stripe.products.create({
        name: productName,
        description: planConfig.description,
        metadata: {
          plan_id: planId,
          credits: planConfig.credits.toString(),
        }
      });
      logStep("Created product", { productId: product.id });
    }

    // Create the regular monthly price
    const regularPriceObj = await stripe.prices.create({
      product: product.id,
      unit_amount: regularMonthlyPrice,
      currency: 'usd',
      recurring: {
        interval: 'month',
        interval_count: 1,
      },
      metadata: {
        type: 'regular',
        plan_id: planId,
      }
    });
    logStep("Created regular price", { priceId: regularPriceObj.id });

    // Create a coupon that discounts to $1 for the first month only
    const coupon = await stripe.coupons.create({
      amount_off: discountAmount,
      currency: 'usd',
      duration: 'once', // Only applies to first invoice
      name: `$1 First Month - ${planConfig.name}`,
      metadata: {
        type: 'first_month_promo',
        plan_id: planId,
      }
    });
    logStep("Created coupon", { couponId: coupon.id, discountAmount });

    // Create checkout session with regular price + coupon for first month discount
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price: regularPriceObj.id,
          quantity: 1,
        },
      ],
      discounts: [
        {
          coupon: coupon.id,
        }
      ],
      mode: "subscription",
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
          plan_id: planId,
          credits: planConfig.credits.toString(),
        },
      },
      success_url: `${origin}/onboarding/phone?checkout=success`,
      cancel_url: `${origin}/onboarding/select-plan?checkout=cancelled`,
      payment_method_collection: "always",
      metadata: {
        supabase_user_id: user.id,
        plan: planId,
      },
    });

    logStep("Checkout session created", {
      sessionId: session.id,
      planId: planId,
      sessionMetadataPlan: session.metadata?.plan,
      url: session.url,
      regularPrice: regularMonthlyPrice,
      couponDiscount: discountAmount,
      firstMonthTotal: firstMonthTargetPrice,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
