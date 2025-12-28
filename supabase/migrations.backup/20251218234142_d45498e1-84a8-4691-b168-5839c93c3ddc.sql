-- Fix existing users without organizations
DO $$
DECLARE
  profile_record RECORD;
  new_org_id UUID;
  org_name TEXT;
BEGIN
  FOR profile_record IN 
    SELECT id, email, full_name 
    FROM public.profiles 
    WHERE organization_id IS NULL
  LOOP
    -- Create organization
    org_name := COALESCE(profile_record.full_name, split_part(profile_record.email, '@', 1)) || '''s Organization';
    
    INSERT INTO public.organizations (name, slug)
    VALUES (org_name, lower(replace(org_name, ' ', '-')) || '-' || substr(gen_random_uuid()::text, 1, 8))
    RETURNING id INTO new_org_id;
    
    -- Update profile with organization
    UPDATE public.profiles 
    SET organization_id = new_org_id
    WHERE id = profile_record.id;
    
    -- Ensure user has owner role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (profile_record.id, 'owner')
    ON CONFLICT (user_id, role) DO NOTHING;
    
    -- Create trial subscription if not exists
    INSERT INTO public.subscriptions (organization_id, plan, status, current_period_start, current_period_end)
    VALUES (
      new_org_id,
      'starter',
      'trialing',
      now(),
      now() + interval '30 days'
    )
    ON CONFLICT (organization_id) DO NOTHING;
  END LOOP;
END;
$$;