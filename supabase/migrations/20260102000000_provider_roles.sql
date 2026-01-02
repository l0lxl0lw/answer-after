-- ============================================
-- Provider Roles System
-- ============================================
-- Organization-specific custom roles for providers
-- Enables role-based service assignments

-- ============================================
-- PROVIDER ROLES TABLE
-- ============================================

CREATE TABLE public.provider_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,           -- Display name: "Dentist", "Dental Hygienist"
  slug TEXT NOT NULL,           -- Machine name: "dentist", "dental-hygienist"
  is_default BOOLEAN NOT NULL DEFAULT false,  -- True for seeded defaults
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(organization_id, slug)
);

CREATE INDEX idx_provider_roles_org ON public.provider_roles(organization_id);
CREATE INDEX idx_provider_roles_org_order ON public.provider_roles(organization_id, display_order);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.provider_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Block anonymous access to provider_roles"
  ON public.provider_roles FOR SELECT TO anon USING (false);

CREATE POLICY "Users can view roles in their organization"
  ON public.provider_roles FOR SELECT TO authenticated
  USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Owners/admins can manage roles"
  ON public.provider_roles FOR ALL TO authenticated
  USING (
    organization_id = get_user_organization_id(auth.uid())
    AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'))
  )
  WITH CHECK (
    organization_id = get_user_organization_id(auth.uid())
    AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'))
  );

CREATE POLICY "Service role can manage provider roles"
  ON public.provider_roles FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER update_provider_roles_updated_at
  BEFORE UPDATE ON public.provider_roles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- MODIFY PROVIDERS TABLE
-- ============================================

-- Add role_id FK column
ALTER TABLE public.providers
  ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES public.provider_roles(id) ON DELETE SET NULL;

-- Make legacy role column nullable (was NOT NULL, now optional as we use role_id)
ALTER TABLE public.providers
  ALTER COLUMN role DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_providers_role_id ON public.providers(role_id);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Seed default roles for a new organization
CREATE OR REPLACE FUNCTION public.seed_default_provider_roles(org_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.provider_roles (organization_id, name, slug, is_default, display_order)
  VALUES
    (org_id, 'Dentist', 'dentist', true, 1),
    (org_id, 'Dental Hygienist', 'dental-hygienist', true, 2),
    (org_id, 'Dental Assistant', 'dental-assistant', true, 3),
    (org_id, 'Specialist', 'specialist', true, 4),
    (org_id, 'Receptionist', 'receptionist', true, 5)
  ON CONFLICT (organization_id, slug) DO NOTHING;
END;
$$;

-- Get count of providers using a specific role
CREATE OR REPLACE FUNCTION public.get_role_usage_count(role_uuid UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(COUNT(*)::INTEGER, 0) FROM public.providers WHERE role_id = role_uuid
$$;

-- ============================================
-- DATA MIGRATION FOR EXISTING ORGANIZATIONS
-- ============================================

-- 1. Seed default roles for all existing organizations
DO $$
DECLARE
  org_record RECORD;
BEGIN
  FOR org_record IN SELECT id FROM public.organizations LOOP
    PERFORM public.seed_default_provider_roles(org_record.id);
  END LOOP;
END $$;

-- 2. Migrate existing providers' role TEXT to role_id UUID
UPDATE public.providers p
SET role_id = pr.id
FROM public.provider_roles pr
WHERE p.organization_id = pr.organization_id
  AND p.role_id IS NULL
  AND (
    (p.role = 'dentist' AND pr.slug = 'dentist') OR
    (p.role = 'hygienist' AND pr.slug = 'dental-hygienist') OR
    (p.role = 'assistant' AND pr.slug = 'dental-assistant') OR
    (p.role = 'specialist' AND pr.slug = 'specialist') OR
    (p.role = 'receptionist' AND pr.slug = 'receptionist')
  );
