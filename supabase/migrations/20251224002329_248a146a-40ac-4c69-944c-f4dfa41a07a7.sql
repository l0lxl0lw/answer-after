-- Ensure RLS is enabled on organization_agents (safe to run if already enabled)
ALTER TABLE public.organization_agents ENABLE ROW LEVEL SECURITY;

-- Force RLS for table owner as well (extra security)
ALTER TABLE public.organization_agents FORCE ROW LEVEL SECURITY;

-- Drop and recreate the anonymous block policy to ensure it's properly applied
DROP POLICY IF EXISTS "Block anonymous access to organization_agents" ON public.organization_agents;

-- Create a more explicit blocking policy for all operations from anonymous users
CREATE POLICY "Block anonymous SELECT on organization_agents"
ON public.organization_agents FOR SELECT TO anon USING (false);

CREATE POLICY "Block anonymous INSERT on organization_agents"
ON public.organization_agents FOR INSERT TO anon WITH CHECK (false);

CREATE POLICY "Block anonymous UPDATE on organization_agents"
ON public.organization_agents FOR UPDATE TO anon USING (false);

CREATE POLICY "Block anonymous DELETE on organization_agents"
ON public.organization_agents FOR DELETE TO anon USING (false);