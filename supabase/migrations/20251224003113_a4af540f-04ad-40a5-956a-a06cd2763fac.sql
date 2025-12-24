-- Drop existing policies on appointments
DROP POLICY IF EXISTS "Block anonymous access to appointments" ON public.appointments;
DROP POLICY IF EXISTS "Owners/admins can delete appointments in their organization" ON public.appointments;
DROP POLICY IF EXISTS "Owners/admins can insert appointments in their organization" ON public.appointments;
DROP POLICY IF EXISTS "Owners/admins can update appointments in their organization" ON public.appointments;
DROP POLICY IF EXISTS "Owners/admins can view appointments in their organization" ON public.appointments;

-- Block anonymous users explicitly (targeting anon role)
CREATE POLICY "Block anon SELECT on appointments"
ON public.appointments FOR SELECT TO anon USING (false);

CREATE POLICY "Block anon INSERT on appointments"
ON public.appointments FOR INSERT TO anon WITH CHECK (false);

CREATE POLICY "Block anon UPDATE on appointments"
ON public.appointments FOR UPDATE TO anon USING (false);

CREATE POLICY "Block anon DELETE on appointments"
ON public.appointments FOR DELETE TO anon USING (false);

-- Allow authenticated owners/admins to view appointments in their organization
CREATE POLICY "Org owners admins can view appointments"
ON public.appointments FOR SELECT TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'))
);

-- Allow authenticated owners/admins to insert appointments in their organization
CREATE POLICY "Org owners admins can insert appointments"
ON public.appointments FOR INSERT TO authenticated
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'))
);

-- Allow authenticated owners/admins to update appointments in their organization
CREATE POLICY "Org owners admins can update appointments"
ON public.appointments FOR UPDATE TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'))
);

-- Allow authenticated owners/admins to delete appointments in their organization
CREATE POLICY "Org owners admins can delete appointments"
ON public.appointments FOR DELETE TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'))
);

-- Allow service role full access for backend operations (webhooks, reminders, etc.)
CREATE POLICY "Service role full access to appointments"
ON public.appointments FOR ALL TO service_role USING (true) WITH CHECK (true);