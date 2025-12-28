-- Drop existing policies on google_calendar_connections
DROP POLICY IF EXISTS "Block anonymous access to google_calendar_connections" ON public.google_calendar_connections;
DROP POLICY IF EXISTS "Owners/admins can delete calendar connection" ON public.google_calendar_connections;
DROP POLICY IF EXISTS "Owners/admins can insert calendar connection" ON public.google_calendar_connections;
DROP POLICY IF EXISTS "Owners/admins can update calendar connection" ON public.google_calendar_connections;
DROP POLICY IF EXISTS "Owners/admins can view calendar connection" ON public.google_calendar_connections;

-- Ensure RLS is enabled and forced
ALTER TABLE public.google_calendar_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_calendar_connections FORCE ROW LEVEL SECURITY;

-- Block anonymous users explicitly (targeting anon role)
CREATE POLICY "Block anon SELECT on google_calendar_connections"
ON public.google_calendar_connections FOR SELECT TO anon USING (false);

CREATE POLICY "Block anon INSERT on google_calendar_connections"
ON public.google_calendar_connections FOR INSERT TO anon WITH CHECK (false);

CREATE POLICY "Block anon UPDATE on google_calendar_connections"
ON public.google_calendar_connections FOR UPDATE TO anon USING (false);

CREATE POLICY "Block anon DELETE on google_calendar_connections"
ON public.google_calendar_connections FOR DELETE TO anon USING (false);

-- Only owners can view their organization's calendar connection (not admins - tokens are sensitive)
CREATE POLICY "Org owners can view calendar connection"
ON public.google_calendar_connections FOR SELECT TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'owner')
);

-- Only owners can insert calendar connection
CREATE POLICY "Org owners can insert calendar connection"
ON public.google_calendar_connections FOR INSERT TO authenticated
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'owner')
);

-- Only owners can update calendar connection
CREATE POLICY "Org owners can update calendar connection"
ON public.google_calendar_connections FOR UPDATE TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'owner')
);

-- Only owners can delete calendar connection
CREATE POLICY "Org owners can delete calendar connection"
ON public.google_calendar_connections FOR DELETE TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'owner')
);

-- Service role access for edge functions (required for token refresh)
CREATE POLICY "Service role full access to google_calendar_connections"
ON public.google_calendar_connections FOR ALL TO service_role USING (true) WITH CHECK (true);