-- Add credits columns to subscriptions table
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS total_credits integer NOT NULL DEFAULT 1000,
ADD COLUMN IF NOT EXISTS used_credits integer NOT NULL DEFAULT 0;

-- Add constraint to ensure used_credits doesn't exceed total_credits
ALTER TABLE public.subscriptions 
ADD CONSTRAINT check_credits_valid CHECK (used_credits >= 0 AND used_credits <= total_credits);