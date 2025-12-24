-- Drop the restrictive policy that's blocking access
DROP POLICY IF EXISTS "Authenticated users can view active subscription tiers" ON subscription_tiers;

-- Create a PERMISSIVE policy for authenticated users to view active and visible tiers
CREATE POLICY "Authenticated users can view active visible tiers"
ON subscription_tiers
FOR SELECT
TO authenticated
USING (is_active = true AND is_visible = true);

-- Also allow anon users to view for the landing page pricing section
CREATE POLICY "Anyone can view active visible tiers"
ON subscription_tiers
FOR SELECT
TO anon
USING (is_active = true AND is_visible = true);