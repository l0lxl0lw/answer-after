-- Add foreign key relationship between subscriptions and subscription_tiers
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_plan_fkey
  FOREIGN KEY (plan)
  REFERENCES public.subscription_tiers(plan_id);
