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
    // For yearly: charge the full annual amount upfront (monthly rate × 12)
    // For monthly: charge the monthly amount
    const unitAmount = billingPeriod === 'yearly' 
      ? planConfig.yearlyPrice * 12  // e.g., $29 × 12 = $348 annually
      : planConfig.monthlyPrice;     // e.g., $37 monthly
    const interval = billingPeriod === 'yearly' ? 'year' : 'month';
    
    logStep("Pricing calculated", { 
      billingPeriod, 
      unitAmount, 
      yearlyPerMonth: planConfig.yearlyPrice,
      monthlyPrice: planConfig.monthlyPrice,
      annualTotal: planConfig.yearlyPrice * 12,
      monthlyAnnualTotal: planConfig.monthlyPrice * 12,
      savings: (planConfig.monthlyPrice * 12) - (planConfig.yearlyPrice * 12)
    });

    // Create a dynamic coupon for $1 first period promo
    // Discount is the full amount minus $1
    const discountAmount = unitAmount - 100; // Price minus $1 (100 cents)
    
    const dynamicCoupon = await stripe.coupons.create({
      amount_off: discountAmount,
      currency: 'usd',
      duration: 'once',
      name: billingPeriod === 'yearly' 
        ? `First Year $1 - ${planConfig.name}` 
        : `First Month $1 - ${planConfig.name}`,
      metadata: {
        type: 'first_period_promo',
        plan_id: planId,
        billing_period: billingPeriod,
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
