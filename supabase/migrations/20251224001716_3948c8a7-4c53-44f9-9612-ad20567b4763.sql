-- Block anonymous access to all tables for defense-in-depth security

-- profiles
CREATE POLICY "Block anonymous access to profiles"
ON public.profiles FOR SELECT TO anon USING (false);

-- appointments
CREATE POLICY "Block anonymous access to appointments"
ON public.appointments FOR SELECT TO anon USING (false);

-- appointment_reminders
CREATE POLICY "Block anonymous access to appointment_reminders"
ON public.appointment_reminders FOR SELECT TO anon USING (false);

-- calls
CREATE POLICY "Block anonymous access to calls"
ON public.calls FOR SELECT TO anon USING (false);

-- call_events
CREATE POLICY "Block anonymous access to call_events"
ON public.call_events FOR SELECT TO anon USING (false);

-- call_transcripts
CREATE POLICY "Block anonymous access to call_transcripts"
ON public.call_transcripts FOR SELECT TO anon USING (false);

-- organizations
CREATE POLICY "Block anonymous access to organizations"
ON public.organizations FOR SELECT TO anon USING (false);

-- phone_numbers
CREATE POLICY "Block anonymous access to phone_numbers"
ON public.phone_numbers FOR SELECT TO anon USING (false);

-- google_calendar_connections
CREATE POLICY "Block anonymous access to google_calendar_connections"
ON public.google_calendar_connections FOR SELECT TO anon USING (false);

-- services
CREATE POLICY "Block anonymous access to services"
ON public.services FOR SELECT TO anon USING (false);

-- subscriptions
CREATE POLICY "Block anonymous access to subscriptions"
ON public.subscriptions FOR SELECT TO anon USING (false);

-- user_roles
CREATE POLICY "Block anonymous access to user_roles"
ON public.user_roles FOR SELECT TO anon USING (false);

-- prompt_templates (keep public read for active templates, but block anon writes)
CREATE POLICY "Block anonymous writes to prompt_templates"
ON public.prompt_templates FOR INSERT TO anon WITH CHECK (false);

CREATE POLICY "Block anonymous updates to prompt_templates"
ON public.prompt_templates FOR UPDATE TO anon USING (false);

CREATE POLICY "Block anonymous deletes to prompt_templates"
ON public.prompt_templates FOR DELETE TO anon USING (false);

-- subscription_tiers (keep public read for pricing display, but block anon writes)
CREATE POLICY "Block anonymous writes to subscription_tiers"
ON public.subscription_tiers FOR INSERT TO anon WITH CHECK (false);

CREATE POLICY "Block anonymous updates to subscription_tiers"
ON public.subscription_tiers FOR UPDATE TO anon USING (false);

CREATE POLICY "Block anonymous deletes to subscription_tiers"
ON public.subscription_tiers FOR DELETE TO anon USING (false);