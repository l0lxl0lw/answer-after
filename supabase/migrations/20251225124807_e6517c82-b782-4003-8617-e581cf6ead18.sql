-- Create credit configuration table for burn rates
CREATE TABLE public.credit_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_key text NOT NULL UNIQUE,
  config_value numeric NOT NULL,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.credit_config ENABLE ROW LEVEL SECURITY;

-- Anyone can read config (it's system config)
CREATE POLICY "Anyone can view credit config" 
ON public.credit_config 
FOR SELECT 
USING (true);

-- Insert default burn rates
INSERT INTO public.credit_config (config_key, config_value, description) VALUES
  ('inbound_call_per_second', 0.015, 'Credits burned per second for inbound calls'),
  ('outbound_call_per_second', 0.03, 'Credits burned per second for outbound calls'),
  ('inbound_sms', 0.2, 'Credits burned per inbound SMS'),
  ('outbound_sms', 0.2, 'Credits burned per outbound SMS'),
  ('topup_credits_amount', 300, 'Number of credits per $10 top-up'),
  ('topup_price_cents', 1000, 'Price in cents for credit top-up'),
  ('low_balance_threshold_percent', 25, 'Notify when credits fall below this %'),
  ('critical_balance_threshold_percent', 10, 'Critical warning when credits fall below this %'),
  ('overdraft_limit_credits', 50, 'Soft cap - allow negative balance up to this amount');

-- Create purchased credits table for top-ups (FIFO)
CREATE TABLE public.purchased_credits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  credits_purchased integer NOT NULL,
  credits_remaining integer NOT NULL,
  price_cents integer NOT NULL,
  stripe_payment_intent_id text,
  purchased_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.purchased_credits ENABLE ROW LEVEL SECURITY;

-- Block anonymous access
CREATE POLICY "Block anonymous access to purchased_credits" 
ON public.purchased_credits 
FOR SELECT 
USING (false);

-- Owners/admins can view their org's purchased credits
CREATE POLICY "Owners/admins can view purchased credits" 
ON public.purchased_credits 
FOR SELECT 
USING (
  organization_id = get_user_organization_id(auth.uid()) 
  AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
);

-- Service role can manage purchased credits
CREATE POLICY "Service role can manage purchased credits" 
ON public.purchased_credits 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Add trigger for updated_at on credit_config
CREATE TRIGGER update_credit_config_updated_at
BEFORE UPDATE ON public.credit_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_purchased_credits_org_id ON public.purchased_credits(organization_id);
CREATE INDEX idx_purchased_credits_remaining ON public.purchased_credits(credits_remaining) WHERE credits_remaining > 0;