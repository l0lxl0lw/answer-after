-- Remove default/preset roles - users will create their own

-- 1. Delete all default seeded roles that aren't being used
DELETE FROM public.provider_roles
WHERE is_default = true
  AND id NOT IN (SELECT DISTINCT role_id FROM public.providers WHERE role_id IS NOT NULL);

-- 2. Update remaining default roles to not be marked as default
UPDATE public.provider_roles SET is_default = false WHERE is_default = true;

-- 3. Replace the seed function with a no-op (so new accounts don't get preset roles)
CREATE OR REPLACE FUNCTION public.seed_default_provider_roles(p_account_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- No-op: Users will create their own roles
  -- This function is kept for backwards compatibility but does nothing
  NULL;
END;
$$;

COMMENT ON FUNCTION public.seed_default_provider_roles IS 'Deprecated: No longer seeds default roles. Users create their own custom roles.';
