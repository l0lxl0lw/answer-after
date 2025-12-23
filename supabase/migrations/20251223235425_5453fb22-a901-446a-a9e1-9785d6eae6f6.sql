-- Add is_visible column to subscription_tiers table
ALTER TABLE public.subscription_tiers 
ADD COLUMN is_visible boolean NOT NULL DEFAULT true;

-- Set "internal test" tier to not visible (assuming it has plan_id = 'internal_test' or similar)
UPDATE public.subscription_tiers 
SET is_visible = false 
WHERE LOWER(name) LIKE '%internal%test%' OR LOWER(plan_id) LIKE '%internal%' OR LOWER(plan_id) LIKE '%test%';