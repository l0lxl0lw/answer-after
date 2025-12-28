-- Add column for customizable agent feature
ALTER TABLE public.subscription_tiers 
ADD COLUMN IF NOT EXISTS has_custom_agent BOOLEAN NOT NULL DEFAULT false;

-- Update tiers: Pro, Business, Enterprise get custom agent
UPDATE public.subscription_tiers SET has_custom_agent = true WHERE plan_id IN ('pro', 'business', 'enterprise');
UPDATE public.subscription_tiers SET has_custom_agent = false WHERE plan_id IN ('free', 'starter');