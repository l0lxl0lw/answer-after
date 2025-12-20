-- Create subscription_tiers table to store plan information
CREATE TABLE public.subscription_tiers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id text NOT NULL UNIQUE,
  name text NOT NULL,
  price_cents integer NOT NULL DEFAULT 0,
  period text NOT NULL DEFAULT '/month',
  description text NOT NULL,
  credits integer NOT NULL DEFAULT 0,
  credits_cost_per_thousand numeric(10,2),
  phone_lines integer NOT NULL DEFAULT 1,
  has_custom_ai_training boolean NOT NULL DEFAULT false,
  has_call_recordings boolean NOT NULL DEFAULT false,
  has_api_access boolean NOT NULL DEFAULT false,
  has_priority_support boolean NOT NULL DEFAULT false,
  has_hipaa_compliance boolean NOT NULL DEFAULT false,
  has_sla_guarantee boolean NOT NULL DEFAULT false,
  support_level text NOT NULL DEFAULT 'standard',
  is_popular boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.subscription_tiers ENABLE ROW LEVEL SECURITY;

-- Allow anyone to view active tiers (public pricing page needs this)
CREATE POLICY "Anyone can view active subscription tiers"
ON public.subscription_tiers
FOR SELECT
USING (is_active = true);

-- Insert the default tiers
INSERT INTO public.subscription_tiers (plan_id, name, price_cents, period, description, credits, credits_cost_per_thousand, phone_lines, has_custom_ai_training, has_call_recordings, has_api_access, has_priority_support, has_hipaa_compliance, has_sla_guarantee, support_level, is_popular, display_order, features) VALUES
('free', 'Free', 0, '/month', 'Get started with 1,000 free credits.', 1000, NULL, 1, false, false, false, false, false, false, 'email', false, 0, '["1,000 credits included", "1 credit per call second", "~16 minutes of call time", "1 phone line", "Basic AI call handling", "Email notifications"]'::jsonb),
('starter', 'Starter', 4900, '/month', 'For small service businesses.', 10000, 0.50, 2, false, false, false, false, false, false, 'standard', false, 1, '["10,000 credits included", "~166 minutes of call time", "2 phone lines", "Advanced AI with custom rules", "SMS + Email notifications", "Analytics dashboard"]'::jsonb),
('professional', 'Professional', 14900, '/month', 'For growing businesses.', 50000, 0.35, 5, true, true, true, true, false, false, 'priority', true, 2, '["50,000 credits included", "~833 minutes of call time", "5 phone lines", "Custom AI training", "Priority support", "Call recordings", "API access"]'::jsonb),
('enterprise', 'Enterprise', -1, '', 'For large businesses.', -1, 0.20, -1, true, true, true, true, true, true, 'dedicated_24_7', false, 3, '["Unlimited credits", "Unlimited phone lines", "Custom AI training", "24/7 dedicated support", "Advanced analytics & API", "HIPAA compliance", "Custom integrations", "SLA guarantee"]'::jsonb);

-- Create trigger for updated_at
CREATE TRIGGER update_subscription_tiers_updated_at
BEFORE UPDATE ON public.subscription_tiers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();