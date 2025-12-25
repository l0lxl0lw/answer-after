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

// Plan configurations - monthly is 25% higher than yearly
const PLAN_CONFIG: Record<string, { 
  name: string; 
  monthlyPrice: number;
  yearlyPrice: number;
  credits: number;
  description: string;
}> = {
  core: { 
    name: 'Core', 
    monthlyPrice: 3700,  // $37/mo
    yearlyPrice: 2900,   // $29/mo billed yearly (25% off)
    credits: 250,
    description: 'AI-powered after-hours call handling'
  },
  growth: { 
    name: 'Growth', 
    monthlyPrice: 12500, // $125/mo
    yearlyPrice: 9900,   // $99/mo billed yearly (25% off)
    credits: 600,
    description: 'For growing service businesses'
  },
  pro: { 
    name: 'Pro', 
    monthlyPrice: 24900, // $249/mo
    yearlyPrice: 19900,  // $199/mo billed yearly (25% off)
    credits: 1400,
    description: 'For high-volume operations'
  },
  business: { 
    name: 'Business', 
    monthlyPrice: 62500, // $625/mo
    yearlyPrice: 49900,  // $499/mo billed yearly (25% off)
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
    logStep("Stripe key verified");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Parse request body for plan selection
    let planId = 'growth'; // default plan
    let billingPeriod = 'monthly';
    
    try {
      const body = await req.json();
      if (body.planId && PLAN_CONFIG[body.planId]) {
        planId = body.planId;
      }
      if (body.billingPeriod === 'yearly') {
        billingPeriod = 'yearly';
      }
    } catch {
      // Use defaults
    }

    const planConfig = PLAN_CONFIG[planId];
    logStep("Plan selected", { planId, billingPeriod, config: planConfig });

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

    // Strategy: Use a simple monthly subscription for first month at $1
    // Then after checkout, we'll use subscription schedule to transition to regular pricing
    // This shows clearly: "$1.00 today, then $X/mo (or $X/year) after 30 days"
    
    const firstMonthPrice = 100; // $1
    const regularAmount = billingPeriod === 'yearly' 
      ? planConfig.yearlyPrice * 12  // e.g., $199 × 12 = $2388 annually
      : planConfig.monthlyPrice;     // e.g., $249 monthly
    
    logStep("Pricing calculated", { 
      billingPeriod, 
      firstMonthPrice,
      regularAmount, 
      yearlyPerMonth: planConfig.yearlyPrice,
      monthlyPrice: planConfig.monthlyPrice,
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

    // Create the $1 first month price
    const firstMonthPriceObj = await stripe.prices.create({
      product: product.id,
      unit_amount: firstMonthPrice,
      currency: 'usd',
      recurring: {
        interval: 'month',
        interval_count: 1,
      },
      metadata: {
        type: 'first_month_promo',
        plan_id: planId,
      }
    });
    logStep("Created first month price", { priceId: firstMonthPriceObj.id });

    // Create the regular price
    const regularPriceObj = await stripe.prices.create({
      product: product.id,
      unit_amount: regularAmount,
      currency: 'usd',
      recurring: {
        interval: billingPeriod === 'yearly' ? 'year' : 'month',
        interval_count: 1,
      },
      metadata: {
        type: 'regular',
        plan_id: planId,
        billing_period: billingPeriod,
      }
    });
    logStep("Created regular price", { priceId: regularPriceObj.id });

    // Use checkout session with subscription_data to set up a subscription schedule
    // This creates a clear flow: pay $1 now, regular billing starts after 1 month
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price: firstMonthPriceObj.id,
          quantity: 1,
        },
      ],
      mode: "subscription",
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
          plan_id: planId,
          billing_period: billingPeriod,
          credits: planConfig.credits.toString(),
          regular_price_id: regularPriceObj.id, // Store for webhook to use
          switch_to_regular: 'true', // Flag for webhook
        },
        description: `$1 first month, then $${(regularAmount / 100).toFixed(0)}/${billingPeriod === 'yearly' ? 'year' : 'month'} after 30 days`,
      },
      success_url: `${origin}/onboarding/phone?checkout=success`,
      cancel_url: `${origin}/onboarding/select-plan?checkout=cancelled`,
      payment_method_collection: "always",
      metadata: {
        supabase_user_id: user.id,
        plan: planId,
        billing_period: billingPeriod,
        regular_price_id: regularPriceObj.id,
      },
    });

    logStep("Checkout session created", { 
      sessionId: session.id, 
      url: session.url,
      planId,
      billingPeriod,
      firstMonthCharge: firstMonthPrice,
      regularPrice: regularAmount,
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
