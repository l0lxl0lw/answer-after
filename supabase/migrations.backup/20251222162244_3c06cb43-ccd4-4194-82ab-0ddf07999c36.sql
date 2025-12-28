-- Drop existing restrictive SELECT policy on profiles
DROP POLICY IF EXISTS "Users can view profiles in their organization" ON public.profiles;

-- Create a proper PERMISSIVE SELECT policy that requires authentication
-- Users can only view their own profile OR profiles in their organization
CREATE POLICY "Users can view profiles in their organization"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  (id = auth.uid()) 
  OR 
  (organization_id IS NOT NULL AND organization_id = get_user_organization_id(auth.uid()))
);

-- Ensure there's no public/anon access - explicitly deny by not having any policy for anon role
-- The TO authenticated clause above ensures only authenticated users can access