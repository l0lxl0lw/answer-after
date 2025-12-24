-- Drop existing SELECT policies on profiles
DROP POLICY IF EXISTS "Block anonymous access to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Create explicit block policy for anonymous users
CREATE POLICY "Block anonymous SELECT on profiles"
ON public.profiles FOR SELECT TO anon USING (false);

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid());

-- Owners/admins can view profiles within their organization
CREATE POLICY "Owners admins can view org profiles"
ON public.profiles FOR SELECT TO authenticated
USING (
  organization_id IS NOT NULL 
  AND organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'))
);