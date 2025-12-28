-- Add onboarding tracking columns to organizations
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS is_onboarding_complete boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamp with time zone;