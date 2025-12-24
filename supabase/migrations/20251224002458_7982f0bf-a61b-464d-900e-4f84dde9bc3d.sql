-- Ensure RLS is enabled on appointments (safe to run if already enabled)
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Force RLS for table owner as well (prevents bypass even for table owner)
ALTER TABLE public.appointments FORCE ROW LEVEL SECURITY;