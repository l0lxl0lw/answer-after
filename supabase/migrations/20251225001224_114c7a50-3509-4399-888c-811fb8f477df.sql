-- Create verification codes table for email and phone verification
CREATE TABLE public.verification_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  phone text,
  code text NOT NULL,
  type text NOT NULL CHECK (type IN ('email', 'phone')),
  expires_at timestamp with time zone NOT NULL,
  verified_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create index for lookup
CREATE INDEX idx_verification_codes_lookup ON public.verification_codes(email, phone, type, code);
CREATE INDEX idx_verification_codes_user ON public.verification_codes(user_id, type);

-- Enable RLS
ALTER TABLE public.verification_codes ENABLE ROW LEVEL SECURITY;

-- Service role can manage all verification codes
CREATE POLICY "Service role can manage verification codes"
ON public.verification_codes
FOR ALL
USING (true)
WITH CHECK (true);

-- Block anonymous access
CREATE POLICY "Block anonymous access to verification_codes"
ON public.verification_codes
FOR SELECT
USING (false);

-- Add email_verified and phone_verified to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS phone_verified boolean NOT NULL DEFAULT false;

-- Add notification_phone to profiles for phone collection during signup
-- (already exists in organizations, but we need it during signup before org exists)