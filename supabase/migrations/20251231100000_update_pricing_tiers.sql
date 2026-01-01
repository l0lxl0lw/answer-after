-- ============================================
-- Update Pricing Tiers for Dental Office Market
-- ============================================
-- Restructures pricing to be competitive with dental AI receptionist market
-- Changes credit allocations to market-competitive levels (100-1200 min)
-- Updates feature gating per new plan

-- Rename 'core' to 'starter' and update values
UPDATE public.subscription_tiers SET
  plan_id = 'starter',
  name = 'Starter',
  description = 'Perfect for solo practices and after-hours coverage',
  price_cents = 4900,
  credits = 6000,  -- 100 minutes
  features = '["24/7 AI call answering", "Appointment scheduling", "Call recordings", "HIPAA compliant", "Email notifications", "Email support"]'::jsonb,
  has_custom_agent = false,
  has_outbound_reminders = false,
  has_call_recordings = true,
  has_api_access = false,
  has_priority_support = false,
  has_custom_ai_training = false,
  has_sla_guarantee = false,
  has_voice_selection = false,
  has_multi_language = false,
  support_level = 'email'
WHERE plan_id = 'core';

-- Update Growth plan
UPDATE public.subscription_tiers SET
  description = 'Ideal for small practices with 1-2 dentists',
  price_cents = 9900,
  credits = 12000,  -- 200 minutes
  features = '["Everything in Starter", "NexHealth/PMS integration", "Google Calendar sync", "Define your services", "Appointment reminders"]'::jsonb,
  has_custom_agent = true,  -- can define services
  has_outbound_reminders = false,
  has_call_recordings = true,
  has_api_access = false,
  has_priority_support = false,
  has_custom_ai_training = false,
  has_sla_guarantee = false,
  has_voice_selection = false,
  has_multi_language = false,
  support_level = 'email'
WHERE plan_id = 'growth';

-- Update Pro plan
UPDATE public.subscription_tiers SET
  description = 'Best for busy practices needing full AI customization',
  price_cents = 19900,
  credits = 30000,  -- 500 minutes
  features = '["Everything in Growth", "Custom AI context & prompts", "Custom AI training", "Voice selection", "Advanced analytics", "Lead tracking", "Priority support"]'::jsonb,
  has_custom_agent = true,
  has_outbound_reminders = false,
  has_call_recordings = true,
  has_api_access = false,
  has_priority_support = true,
  has_custom_ai_training = true,
  has_sla_guarantee = false,
  has_voice_selection = true,
  has_multi_language = false,
  support_level = 'priority'
WHERE plan_id = 'pro';

-- Update Business plan
UPDATE public.subscription_tiers SET
  description = 'Complete solution for high-volume and multi-location practices',
  price_cents = 49900,
  credits = 72000,  -- 1200 minutes
  features = '["Everything in Pro", "Outbound appointment reminders", "Multilingual (Spanish)", "SMS capabilities", "Dedicated account manager"]'::jsonb,
  has_custom_agent = true,
  has_outbound_reminders = true,
  has_call_recordings = true,
  has_api_access = false,
  has_priority_support = true,
  has_custom_ai_training = true,
  has_sla_guarantee = false,
  has_voice_selection = true,
  has_multi_language = true,
  support_level = 'dedicated'
WHERE plan_id = 'business';

-- Update Enterprise plan (keep custom, just update features list)
UPDATE public.subscription_tiers SET
  description = 'Custom solution for DSOs and large dental groups',
  features = '["Everything in Business", "API access", "SLA guarantee", "Custom integrations", "Multi-location support", "Dedicated onboarding"]'::jsonb,
  has_api_access = true,
  has_sla_guarantee = true
WHERE plan_id = 'enterprise';

-- ============================================
-- Update Credit Config for Top-up Packages
-- ============================================

-- Update existing topup config (assuming keys exist)
-- If they don't exist, we'll insert them

-- First, delete old topup config if it exists
DELETE FROM public.credit_config WHERE config_key IN (
  'topup_credits_amount',
  'topup_price_cents'
);

-- Insert new top-up package configs
INSERT INTO public.credit_config (config_key, config_value, description) VALUES
  -- Basic package: $5 for 300 credits (5 min)
  ('topup_basic_credits', 300, 'Basic top-up package: credits included'),
  ('topup_basic_price_cents', 500, 'Basic top-up package: price in cents'),
  -- Value package: $15 for 1000 credits (17 min)
  ('topup_value_credits', 1000, 'Value top-up package: credits included'),
  ('topup_value_price_cents', 1500, 'Value top-up package: price in cents'),
  -- Bulk package: $40 for 3000 credits (50 min)
  ('topup_bulk_credits', 3000, 'Bulk top-up package: credits included'),
  ('topup_bulk_price_cents', 4000, 'Bulk top-up package: price in cents'),
  -- Overage rate
  ('overage_price_cents_per_minute', 150, 'Auto-charge overage rate: cents per minute')
ON CONFLICT (config_key) DO UPDATE SET
  config_value = EXCLUDED.config_value,
  description = EXCLUDED.description;

-- ============================================
-- Update any existing subscriptions to new tier name
-- ============================================
UPDATE public.subscriptions SET plan = 'starter' WHERE plan = 'core';
