-- Add policy to explicitly block anonymous access to organization_agents
CREATE POLICY "Block anonymous access to organization_agents"
ON public.organization_agents
FOR SELECT
TO anon
USING (false);