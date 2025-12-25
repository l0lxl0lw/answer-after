-- Remove annual billing columns from subscription_tiers since we're monthly-only now
ALTER TABLE public.subscription_tiers DROP COLUMN IF EXISTS yearly_price_cents;
ALTER TABLE public.subscription_tiers DROP COLUMN IF EXISTS yearly_discount_percent;
ALTER TABLE public.subscription_tiers DROP COLUMN IF EXISTS stripe_yearly_price_id;