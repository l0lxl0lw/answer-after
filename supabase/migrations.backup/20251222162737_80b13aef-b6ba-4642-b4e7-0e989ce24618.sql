-- Drop existing restrictive policies on appointments
DROP POLICY IF EXISTS "Users can manage appointments in their organization" ON public.appointments;
DROP POLICY IF EXISTS "Users can view appointments in their organization" ON public.appointments;

-- Create proper PERMISSIVE policies that require authentication
-- Users can only view appointments in their organization
CREATE POLICY "Users can view appointments in their organization"
ON public.appointments
FOR SELECT
TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()));

-- Users can insert appointments in their organization
CREATE POLICY "Users can insert appointments in their organization"
ON public.appointments
FOR INSERT
TO authenticated
WITH CHECK (organization_id = get_user_organization_id(auth.uid()));

-- Users can update appointments in their organization
CREATE POLICY "Users can update appointments in their organization"
ON public.appointments
FOR UPDATE
TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()));

-- Users can delete appointments in their organization
CREATE POLICY "Users can delete appointments in their organization"
ON public.appointments
FOR DELETE
TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()));