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

// Plan configurations with Stripe price IDs
const PLAN_CONFIG: Record<string, { 
  name: string; 
  monthlyPrice: number;
  yearlyPrice: number;
  credits: number;
  description: string;
}> = {
  core: { 
    name: 'Core', 
    monthlyPrice: 2900,  // $29
    yearlyPrice: 2175,   // $21.75/mo billed yearly
    credits: 250,
    description: 'AI-powered after-hours call handling'
  },
  growth: { 
    name: 'Growth', 
    monthlyPrice: 9900,  // $99
    yearlyPrice: 7425,   // $74.25/mo billed yearly
    credits: 600,
    description: 'For growing service businesses'
  },
  pro: { 
    name: 'Pro', 
    monthlyPrice: 19900, // $199
    yearlyPrice: 14925,  // $149.25/mo billed yearly
    credits: 1400,
    description: 'For high-volume operations'
  },
  business: { 
    name: 'Business', 
    monthlyPrice: 49900, // $499
    yearlyPrice: 37425,  // $374.25/mo billed yearly
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

    // Create or get the $1 first month coupon
    let couponId = 'FIRST_MONTH_1_DOLLAR';
    try {
      await stripe.coupons.retrieve(couponId);
      logStep("Coupon exists", { couponId });
    } catch {
      // Coupon doesn't exist, create it
      // This creates a coupon that discounts to $1 for the first month
      // We'll use amount_off instead since percent_off won't work for varying prices
      // Actually, we need to use a promotion code approach or calculate dynamically
      logStep("Coupon will be applied via trial with $1 payment");
    }

    const origin = req.headers.get("origin") || "https://ppfynksalwrdqhyrxqzs.lovableproject.com";

    // Calculate the unit amount based on billing period
    const unitAmount = billingPeriod === 'yearly' ? planConfig.yearlyPrice : planConfig.monthlyPrice;
    const interval = billingPeriod === 'yearly' ? 'year' : 'month';
    
    // For $1 first month promo:
    // We'll use subscription_data with trial and then charge $1 immediately using a separate payment
    // OR use Stripe's coupon system with amount_off
    
    // Better approach: Use trial_period_days=30 and set the trial_end to charge $1 upfront
    // Actually, cleanest is: Create coupon that gives ($price - $1) off for first period

    // Create a dynamic coupon for this specific checkout that discounts to $1
    const discountAmount = unitAmount - 100; // Price minus $1 (100 cents)
    
    const dynamicCoupon = await stripe.coupons.create({
      amount_off: discountAmount,
      currency: 'usd',
      duration: 'once',
      name: `First Month $1 - ${planConfig.name}`,
      metadata: {
        type: 'first_month_promo',
        plan_id: planId,
      }
    });
    logStep("Created dynamic coupon", { couponId: dynamicCoupon.id, discountAmount });

    // Create checkout session with the coupon applied
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `AnswerAfter ${planConfig.name}`,
              description: planConfig.description,
              metadata: {
                plan_id: planId,
                credits: planConfig.credits.toString(),
              }
            },
            unit_amount: unitAmount,
            recurring: {
              interval: interval as 'month' | 'year',
            },
          },
          quantity: 1,
        },
      ],
      discounts: [
        {
          coupon: dynamicCoupon.id,
        }
      ],
      mode: "subscription",
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
          plan_id: planId,
          billing_period: billingPeriod,
          credits: planConfig.credits.toString(),
        },
      },
      success_url: `${origin}/onboarding/phone?checkout=success`,
      cancel_url: `${origin}/onboarding/select-plan?checkout=cancelled`,
      payment_method_collection: "always",
      metadata: {
        supabase_user_id: user.id,
        plan: planId,
        billing_period: billingPeriod,
      },
    });

    logStep("Checkout session created", { 
      sessionId: session.id, 
      url: session.url,
      planId,
      billingPeriod,
      firstMonthCharge: 100, // $1
      regularPrice: unitAmount
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
