-- Add idempotency tracking table
CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  result jsonb,
  processed_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_key ON public.idempotency_keys(key);
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_created_at ON public.idempotency_keys(created_at);

-- Auto-cleanup old keys (older than 30 days)
-- This could be a cron job or trigger
CREATE OR REPLACE FUNCTION public.cleanup_old_idempotency_keys()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.idempotency_keys
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$;

-- RLS policies
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

-- Only service role can access idempotency keys
CREATE POLICY "Service role full access to idempotency_keys"
  ON public.idempotency_keys
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Block all other access
CREATE POLICY "Block all other access to idempotency_keys"
  ON public.idempotency_keys
  FOR ALL
  USING (false)
  WITH CHECK (false);
