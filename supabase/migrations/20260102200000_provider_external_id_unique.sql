-- ============================================
-- Provider External ID Unique Constraint
-- ============================================
-- Enables upsert for NexHealth provider sync using external_id

-- Add unique constraint for NexHealth sync (partial index - only where external_id is set)
CREATE UNIQUE INDEX IF NOT EXISTS idx_providers_account_external_id
  ON public.providers(account_id, external_id)
  WHERE external_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON INDEX idx_providers_account_external_id IS 'Unique constraint for NexHealth provider sync - allows upsert by external_id';
