-- Add Twilio sub-account tracking to organizations
ALTER TABLE public.organizations
ADD COLUMN twilio_subaccount_sid text,
ADD COLUMN twilio_subaccount_auth_token text;

-- Add shared/dedicated tracking to phone_numbers
ALTER TABLE public.phone_numbers
ADD COLUMN is_shared boolean NOT NULL DEFAULT false,
ADD COLUMN provisioned_at timestamp with time zone;

-- Create a table for the shared free-tier phone numbers pool
CREATE TABLE public.free_tier_phone_pool (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text NOT NULL UNIQUE,
  twilio_sid text,
  friendly_name text,
  is_available boolean NOT NULL DEFAULT true,
  assigned_count integer NOT NULL DEFAULT 0,
  max_assignments integer NOT NULL DEFAULT 50,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.free_tier_phone_pool ENABLE ROW LEVEL SECURITY;

-- Only service role can manage the pool
CREATE POLICY "Service role can manage free tier pool"
ON public.free_tier_phone_pool
FOR ALL
USING (true)
WITH CHECK (true);

-- Block anonymous access
CREATE POLICY "Block anonymous access to free_tier_phone_pool"
ON public.free_tier_phone_pool
FOR SELECT
USING (false);

-- Create trigger for updated_at
CREATE TRIGGER update_free_tier_phone_pool_updated_at
BEFORE UPDATE ON public.free_tier_phone_pool
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();