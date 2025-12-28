-- Allow service role to insert organizations
CREATE POLICY "Service role can insert organizations"
ON public.organizations
FOR INSERT
WITH CHECK (true);

-- Allow service role to manage user_roles
CREATE POLICY "Service role can manage user_roles"
ON public.user_roles
FOR ALL
USING (true)
WITH CHECK (true);