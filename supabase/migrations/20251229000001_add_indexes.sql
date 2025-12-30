-- ============================================
-- Add indexes for high-traffic query patterns
-- ============================================

-- Calls table - frequently queried by organization and status
CREATE INDEX IF NOT EXISTS idx_calls_org_status
  ON public.calls(organization_id, status);

-- Calls table - for listing calls ordered by date
CREATE INDEX IF NOT EXISTS idx_calls_created_at
  ON public.calls(organization_id, created_at DESC);

-- Appointments table - frequently queried by organization and status
CREATE INDEX IF NOT EXISTS idx_appointments_org_status
  ON public.appointments(organization_id, status);

-- Appointments table - for date range queries
CREATE INDEX IF NOT EXISTS idx_appointments_scheduled
  ON public.appointments(organization_id, scheduled_start);

-- Services table - frequently queried active services
CREATE INDEX IF NOT EXISTS idx_services_org_active
  ON public.services(organization_id, is_active);

-- Profiles table - lookup by organization
CREATE INDEX IF NOT EXISTS idx_profiles_organization
  ON public.profiles(organization_id);

-- Organizations table - lookup by slug (for URL routing)
CREATE INDEX IF NOT EXISTS idx_organizations_slug
  ON public.organizations(slug);
