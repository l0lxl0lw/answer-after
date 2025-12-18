-- Update the handle_new_user function to also create a trial subscription
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  org_id UUID;
  org_name TEXT;
BEGIN
  -- Get organization name from metadata or use email prefix
  org_name := COALESCE(
    new.raw_user_meta_data->>'organization_name',
    split_part(new.email, '@', 1) || '''s Organization'
  );
  
  -- Create organization for new user
  INSERT INTO public.organizations (name, slug)
  VALUES (org_name, lower(replace(org_name, ' ', '-')) || '-' || substr(gen_random_uuid()::text, 1, 8))
  RETURNING id INTO org_id;
  
  -- Create profile
  INSERT INTO public.profiles (id, organization_id, email, full_name)
  VALUES (
    new.id,
    org_id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  
  -- Assign owner role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'owner');
  
  -- Create trial subscription (30 days)
  INSERT INTO public.subscriptions (organization_id, plan, status, current_period_start, current_period_end)
  VALUES (
    org_id,
    'starter',
    'trialing',
    now(),
    now() + interval '30 days'
  );
  
  RETURN new;
END;
$$;