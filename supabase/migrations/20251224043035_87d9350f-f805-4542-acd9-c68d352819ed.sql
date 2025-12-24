-- Add yearly pricing columns to subscription_tiers
ALTER TABLE public.subscription_tiers
ADD COLUMN yearly_price_cents integer DEFAULT 0,
ADD COLUMN yearly_discount_percent integer DEFAULT 0,
ADD COLUMN stripe_monthly_price_id text,
ADD COLUMN stripe_yearly_price_id text;

-- Update existing tiers with yearly pricing (roughly 25% discount when paying yearly)
-- Core: $79/mo monthly = $948/yr, yearly = $59/mo = $708/yr (25% off)
UPDATE public.subscription_tiers SET 
  yearly_price_cents = 5900,
  yearly_discount_percent = 25
WHERE plan_id = 'core';

-- Growth: $199/mo monthly = $2388/yr, yearly = $149/mo = $1788/yr (25% off)
UPDATE public.subscription_tiers SET 
  yearly_price_cents = 14900,
  yearly_discount_percent = 25
WHERE plan_id = 'growth';

-- Pro: $399/mo monthly = $4788/yr, yearly = $299/mo = $3588/yr (25% off)
UPDATE public.subscription_tiers SET 
  yearly_price_cents = 29900,
  yearly_discount_percent = 25
WHERE plan_id = 'pro_new';

-- Enterprise: custom pricing, no yearly discount
UPDATE public.subscription_tiers SET 
  yearly_price_cents = -1,
  yearly_discount_percent = 0
WHERE plan_id = 'enterprise';