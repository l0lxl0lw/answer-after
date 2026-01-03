-- ============================================
-- RENAME ORGANIZATIONS TO INSTITUTIONS
-- ============================================
-- Single migration to rename all organization references to institution
-- Includes: tables, columns, functions, RLS policies, indexes

-- ============================================
-- STEP 1: DROP ALL RLS POLICIES
-- ============================================
-- Must drop policies before renaming columns/tables since they reference old names

-- Organizations (will be renamed to institutions)
DROP POLICY IF EXISTS "Block anonymous access to organizations" ON public.organizations;
DROP POLICY IF EXISTS "Users can view their organization" ON public.organizations;
DROP POLICY IF EXISTS "Owners can update their organization" ON public.organizations;
DROP POLICY IF EXISTS "Service role can insert organizations" ON public.organizations;

-- Profiles
DROP POLICY IF EXISTS "Block anonymous SELECT on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Owners admins can view org profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Phone numbers
DROP POLICY IF EXISTS "Block anonymous access to phone_numbers" ON public.phone_numbers;
DROP POLICY IF EXISTS "Users can view phone numbers in their organization" ON public.phone_numbers;
DROP POLICY IF EXISTS "Owners can manage phone numbers" ON public.phone_numbers;

-- Calls
DROP POLICY IF EXISTS "Block anonymous access to calls" ON public.calls;
DROP POLICY IF EXISTS "Owners/admins can view calls in their organization" ON public.calls;
DROP POLICY IF EXISTS "Service role can insert calls" ON public.calls;
DROP POLICY IF EXISTS "Service role can update calls" ON public.calls;

-- Call events
DROP POLICY IF EXISTS "Block anonymous access to call_events" ON public.call_events;
DROP POLICY IF EXISTS "Owners/admins can view call events for their org calls" ON public.call_events;
DROP POLICY IF EXISTS "Service role can insert call events" ON public.call_events;

-- Call transcripts
DROP POLICY IF EXISTS "Block anonymous access to call_transcripts" ON public.call_transcripts;
DROP POLICY IF EXISTS "Owners/admins can view transcripts for their org calls" ON public.call_transcripts;
DROP POLICY IF EXISTS "Service role can insert transcripts" ON public.call_transcripts;

-- Appointments
DROP POLICY IF EXISTS "Block anon SELECT on appointments" ON public.appointments;
DROP POLICY IF EXISTS "Block anon INSERT on appointments" ON public.appointments;
DROP POLICY IF EXISTS "Block anon UPDATE on appointments" ON public.appointments;
DROP POLICY IF EXISTS "Block anon DELETE on appointments" ON public.appointments;
DROP POLICY IF EXISTS "Org owners admins can view appointments" ON public.appointments;
DROP POLICY IF EXISTS "Org owners admins can insert appointments" ON public.appointments;
DROP POLICY IF EXISTS "Org owners admins can update appointments" ON public.appointments;
DROP POLICY IF EXISTS "Org owners admins can delete appointments" ON public.appointments;
DROP POLICY IF EXISTS "Service role full access to appointments" ON public.appointments;

-- Appointment reminders
DROP POLICY IF EXISTS "Block anonymous access to appointment_reminders" ON public.appointment_reminders;
DROP POLICY IF EXISTS "Owners/admins can view reminders in their organization" ON public.appointment_reminders;
DROP POLICY IF EXISTS "Owners/admins can manage reminders" ON public.appointment_reminders;
DROP POLICY IF EXISTS "Service role can manage reminders" ON public.appointment_reminders;

-- Subscriptions
DROP POLICY IF EXISTS "Block anonymous access to subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Owners/admins can view organization subscription" ON public.subscriptions;

-- Services
DROP POLICY IF EXISTS "Block anonymous access to services" ON public.services;
DROP POLICY IF EXISTS "Users can view services in their organization" ON public.services;
DROP POLICY IF EXISTS "Owners/admins can insert services" ON public.services;
DROP POLICY IF EXISTS "Owners/admins can update services" ON public.services;
DROP POLICY IF EXISTS "Owners/admins can delete services" ON public.services;

-- Organization agents (will be renamed to institution_agents)
DROP POLICY IF EXISTS "Block anonymous SELECT on organization_agents" ON public.organization_agents;
DROP POLICY IF EXISTS "Block anonymous INSERT on organization_agents" ON public.organization_agents;
DROP POLICY IF EXISTS "Block anonymous UPDATE on organization_agents" ON public.organization_agents;
DROP POLICY IF EXISTS "Block anonymous DELETE on organization_agents" ON public.organization_agents;
DROP POLICY IF EXISTS "Owners/admins can view organization agent" ON public.organization_agents;
DROP POLICY IF EXISTS "Owners can update their organization agent" ON public.organization_agents;
DROP POLICY IF EXISTS "Service role can manage organization agents" ON public.organization_agents;

-- Google calendar connections (table may not exist if removed in earlier migration)
-- DROP POLICY IF EXISTS "Block anon SELECT on google_calendar_connections" ON public.google_calendar_connections;
-- DROP POLICY IF EXISTS "Block anon INSERT on google_calendar_connections" ON public.google_calendar_connections;
-- DROP POLICY IF EXISTS "Block anon UPDATE on google_calendar_connections" ON public.google_calendar_connections;
-- DROP POLICY IF EXISTS "Block anon DELETE on google_calendar_connections" ON public.google_calendar_connections;
-- DROP POLICY IF EXISTS "Org owners can view calendar connection" ON public.google_calendar_connections;
-- DROP POLICY IF EXISTS "Org owners can insert calendar connection" ON public.google_calendar_connections;
-- DROP POLICY IF EXISTS "Org owners can update calendar connection" ON public.google_calendar_connections;
-- DROP POLICY IF EXISTS "Org owners can delete calendar connection" ON public.google_calendar_connections;
-- DROP POLICY IF EXISTS "Service role full access to google_calendar_connections" ON public.google_calendar_connections;

-- Purchased credits
DROP POLICY IF EXISTS "Block anonymous access to purchased_credits" ON public.purchased_credits;
DROP POLICY IF EXISTS "Owners/admins can view purchased credits" ON public.purchased_credits;
DROP POLICY IF EXISTS "Service role can manage purchased credits" ON public.purchased_credits;

-- Contacts
DROP POLICY IF EXISTS "Users can view contacts in their organization" ON public.contacts;
DROP POLICY IF EXISTS "Users can insert contacts in their organization" ON public.contacts;
DROP POLICY IF EXISTS "Users can update contacts in their organization" ON public.contacts;
DROP POLICY IF EXISTS "Users can delete contacts in their organization" ON public.contacts;

-- Providers
DROP POLICY IF EXISTS "Block anonymous access to providers" ON public.providers;
DROP POLICY IF EXISTS "Users can view providers in their organization" ON public.providers;
DROP POLICY IF EXISTS "Owners/admins can manage providers" ON public.providers;
DROP POLICY IF EXISTS "Service role can manage providers" ON public.providers;

-- Provider schedules
DROP POLICY IF EXISTS "Block anonymous access to provider_schedules" ON public.provider_schedules;
DROP POLICY IF EXISTS "Users can view schedules for their org providers" ON public.provider_schedules;
DROP POLICY IF EXISTS "Owners/admins can manage provider schedules" ON public.provider_schedules;
DROP POLICY IF EXISTS "Service role can manage provider schedules" ON public.provider_schedules;

-- Provider schedule overrides
DROP POLICY IF EXISTS "Block anonymous access to provider_schedule_overrides" ON public.provider_schedule_overrides;
DROP POLICY IF EXISTS "Users can view overrides for their org providers" ON public.provider_schedule_overrides;
DROP POLICY IF EXISTS "Owners/admins can manage provider schedule overrides" ON public.provider_schedule_overrides;
DROP POLICY IF EXISTS "Service role can manage provider schedule overrides" ON public.provider_schedule_overrides;

-- Calendar events
DROP POLICY IF EXISTS "Block anonymous access to calendar_events" ON public.calendar_events;
DROP POLICY IF EXISTS "Users can view calendar events in their organization" ON public.calendar_events;
DROP POLICY IF EXISTS "Owners/admins can manage calendar events" ON public.calendar_events;
DROP POLICY IF EXISTS "Service role can manage calendar events" ON public.calendar_events;

-- Calendar sync log
DROP POLICY IF EXISTS "Block anonymous access to calendar_sync_log" ON public.calendar_sync_log;
DROP POLICY IF EXISTS "Users can view sync log for their organization" ON public.calendar_sync_log;
DROP POLICY IF EXISTS "Service role can manage calendar sync log" ON public.calendar_sync_log;

-- Provider roles
DROP POLICY IF EXISTS "Block anonymous access to provider_roles" ON public.provider_roles;
DROP POLICY IF EXISTS "Users can view roles in their organization" ON public.provider_roles;
DROP POLICY IF EXISTS "Owners/admins can manage roles" ON public.provider_roles;
DROP POLICY IF EXISTS "Service role can manage provider roles" ON public.provider_roles;

-- ============================================
-- STEP 2: DROP INDEXES
-- ============================================

DROP INDEX IF EXISTS idx_organizations_slug;
DROP INDEX IF EXISTS idx_profiles_organization;
DROP INDEX IF EXISTS idx_calls_org_status;
DROP INDEX IF EXISTS idx_calls_created_at;
DROP INDEX IF EXISTS idx_appointments_org_status;
DROP INDEX IF EXISTS idx_appointments_scheduled;
DROP INDEX IF EXISTS idx_services_org_active;
DROP INDEX IF EXISTS idx_purchased_credits_org_id;
DROP INDEX IF EXISTS idx_contacts_org_status;
DROP INDEX IF EXISTS idx_contacts_org_phone;
DROP INDEX IF EXISTS idx_contacts_interest;
DROP INDEX IF EXISTS idx_providers_org;
DROP INDEX IF EXISTS idx_providers_active;
DROP INDEX IF EXISTS idx_calendar_events_org_time;
DROP INDEX IF EXISTS idx_calendar_sync_log_org;
DROP INDEX IF EXISTS idx_provider_roles_org;
DROP INDEX IF EXISTS idx_provider_roles_org_order;

-- ============================================
-- STEP 3: RENAME TABLES
-- ============================================

ALTER TABLE public.organizations RENAME TO institutions;
ALTER TABLE public.organization_agents RENAME TO institution_agents;

-- ============================================
-- STEP 4: RENAME COLUMNS (organization_id → institution_id)
-- ============================================

ALTER TABLE public.profiles RENAME COLUMN organization_id TO institution_id;
ALTER TABLE public.phone_numbers RENAME COLUMN organization_id TO institution_id;
ALTER TABLE public.calls RENAME COLUMN organization_id TO institution_id;
ALTER TABLE public.appointments RENAME COLUMN organization_id TO institution_id;
ALTER TABLE public.appointment_reminders RENAME COLUMN organization_id TO institution_id;
ALTER TABLE public.subscriptions RENAME COLUMN organization_id TO institution_id;
ALTER TABLE public.services RENAME COLUMN organization_id TO institution_id;
ALTER TABLE public.institution_agents RENAME COLUMN organization_id TO institution_id;
-- ALTER TABLE public.google_calendar_connections RENAME COLUMN organization_id TO institution_id; -- table removed
ALTER TABLE public.purchased_credits RENAME COLUMN organization_id TO institution_id;
ALTER TABLE public.contacts RENAME COLUMN organization_id TO institution_id;
ALTER TABLE public.providers RENAME COLUMN organization_id TO institution_id;
ALTER TABLE public.calendar_events RENAME COLUMN organization_id TO institution_id;
ALTER TABLE public.calendar_sync_log RENAME COLUMN organization_id TO institution_id;
ALTER TABLE public.provider_roles RENAME COLUMN organization_id TO institution_id;

-- ============================================
-- STEP 5: UPDATE COMMENTS
-- ============================================

COMMENT ON COLUMN public.institutions.business_phone_number IS 'Original business phone number provided by user during onboarding';

-- ============================================
-- STEP 6: UPDATE HELPER FUNCTIONS
-- ============================================

-- Drop old function
DROP FUNCTION IF EXISTS public.get_user_organization_id(uuid);

-- Create new function with institution name
CREATE OR REPLACE FUNCTION public.get_user_institution_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT institution_id FROM public.profiles WHERE id = _user_id
$$;

-- Update seed_default_provider_roles function (uses org_id parameter - keeping internal name but it references institutions)
CREATE OR REPLACE FUNCTION public.seed_default_provider_roles(org_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.provider_roles (institution_id, name, slug, is_default, display_order)
  VALUES
    (org_id, 'Dentist', 'dentist', true, 1),
    (org_id, 'Dental Hygienist', 'dental-hygienist', true, 2),
    (org_id, 'Dental Assistant', 'dental-assistant', true, 3),
    (org_id, 'Specialist', 'specialist', true, 4),
    (org_id, 'Receptionist', 'receptionist', true, 5)
  ON CONFLICT (institution_id, slug) DO NOTHING;
END;
$$;

-- ============================================
-- STEP 7: RECREATE INDEXES
-- ============================================

CREATE INDEX idx_institutions_slug ON public.institutions(slug);
CREATE INDEX idx_profiles_institution ON public.profiles(institution_id);
CREATE INDEX idx_calls_inst_status ON public.calls(institution_id, status);
CREATE INDEX idx_calls_created_at ON public.calls(institution_id, created_at DESC);
CREATE INDEX idx_appointments_inst_status ON public.appointments(institution_id, status);
CREATE INDEX idx_appointments_scheduled ON public.appointments(institution_id, scheduled_start);
CREATE INDEX idx_services_inst_active ON public.services(institution_id, is_active);
CREATE INDEX idx_purchased_credits_inst_id ON public.purchased_credits(institution_id);
CREATE INDEX idx_contacts_inst_status ON public.contacts(institution_id, status);
CREATE INDEX idx_contacts_inst_phone ON public.contacts(institution_id, phone);
CREATE INDEX idx_contacts_interest ON public.contacts(institution_id, interest_level) WHERE status = 'lead';
CREATE INDEX idx_providers_inst ON public.providers(institution_id);
CREATE INDEX idx_providers_active ON public.providers(institution_id, is_active) WHERE is_active = true;
CREATE INDEX idx_calendar_events_inst_time ON public.calendar_events(institution_id, start_time, end_time);
CREATE INDEX idx_calendar_sync_log_inst ON public.calendar_sync_log(institution_id, created_at DESC);
CREATE INDEX idx_provider_roles_inst ON public.provider_roles(institution_id);
CREATE INDEX idx_provider_roles_inst_order ON public.provider_roles(institution_id, display_order);

-- ============================================
-- STEP 8: RECREATE RLS POLICIES
-- ============================================

-- Institutions policies
CREATE POLICY "Block anonymous access to institutions" ON public.institutions FOR SELECT TO anon USING (false);
CREATE POLICY "Users can view their institution" ON public.institutions FOR SELECT TO authenticated USING (id = get_user_institution_id(auth.uid()));
CREATE POLICY "Owners can update their institution" ON public.institutions FOR UPDATE TO authenticated USING ((id = get_user_institution_id(auth.uid())) AND has_role(auth.uid(), 'owner'));
CREATE POLICY "Service role can insert institutions" ON public.institutions FOR INSERT TO service_role WITH CHECK (true);

-- Profiles policies
CREATE POLICY "Block anonymous SELECT on profiles" ON public.profiles FOR SELECT TO anon USING (false);
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Owners admins can view institution profiles" ON public.profiles FOR SELECT TO authenticated USING ((institution_id IS NOT NULL) AND (institution_id = get_user_institution_id(auth.uid())) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin')));
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());

-- Phone numbers policies
CREATE POLICY "Block anonymous access to phone_numbers" ON public.phone_numbers FOR SELECT TO anon USING (false);
CREATE POLICY "Users can view phone numbers in their institution" ON public.phone_numbers FOR SELECT TO authenticated USING (institution_id = get_user_institution_id(auth.uid()));
CREATE POLICY "Owners can manage phone numbers" ON public.phone_numbers FOR ALL TO authenticated USING ((institution_id = get_user_institution_id(auth.uid())) AND has_role(auth.uid(), 'owner'));

-- Calls policies
CREATE POLICY "Block anonymous access to calls" ON public.calls FOR SELECT TO anon USING (false);
CREATE POLICY "Owners/admins can view calls in their institution" ON public.calls FOR SELECT TO authenticated USING ((institution_id = get_user_institution_id(auth.uid())) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin')));
CREATE POLICY "Service role can insert calls" ON public.calls FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service role can update calls" ON public.calls FOR UPDATE TO service_role USING (true);

-- Call events policies
CREATE POLICY "Block anonymous access to call_events" ON public.call_events FOR SELECT TO anon USING (false);
CREATE POLICY "Owners/admins can view call events for their inst calls" ON public.call_events FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM calls WHERE calls.id = call_events.call_id AND calls.institution_id = get_user_institution_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'))));
CREATE POLICY "Service role can insert call events" ON public.call_events FOR INSERT TO service_role WITH CHECK (true);

-- Call transcripts policies
CREATE POLICY "Block anonymous access to call_transcripts" ON public.call_transcripts FOR SELECT TO anon USING (false);
CREATE POLICY "Owners/admins can view transcripts for their inst calls" ON public.call_transcripts FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM calls WHERE calls.id = call_transcripts.call_id AND calls.institution_id = get_user_institution_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'))));
CREATE POLICY "Service role can insert transcripts" ON public.call_transcripts FOR INSERT TO service_role WITH CHECK (true);

-- Appointments policies
CREATE POLICY "Block anon SELECT on appointments" ON public.appointments FOR SELECT TO anon USING (false);
CREATE POLICY "Block anon INSERT on appointments" ON public.appointments FOR INSERT TO anon WITH CHECK (false);
CREATE POLICY "Block anon UPDATE on appointments" ON public.appointments FOR UPDATE TO anon USING (false);
CREATE POLICY "Block anon DELETE on appointments" ON public.appointments FOR DELETE TO anon USING (false);
CREATE POLICY "Institution owners admins can view appointments" ON public.appointments FOR SELECT TO authenticated USING ((institution_id = get_user_institution_id(auth.uid())) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin')));
CREATE POLICY "Institution owners admins can insert appointments" ON public.appointments FOR INSERT TO authenticated WITH CHECK ((institution_id = get_user_institution_id(auth.uid())) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin')));
CREATE POLICY "Institution owners admins can update appointments" ON public.appointments FOR UPDATE TO authenticated USING ((institution_id = get_user_institution_id(auth.uid())) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin')));
CREATE POLICY "Institution owners admins can delete appointments" ON public.appointments FOR DELETE TO authenticated USING ((institution_id = get_user_institution_id(auth.uid())) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin')));
CREATE POLICY "Service role full access to appointments" ON public.appointments FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Appointment reminders policies
CREATE POLICY "Block anonymous access to appointment_reminders" ON public.appointment_reminders FOR SELECT TO anon USING (false);
CREATE POLICY "Owners/admins can view reminders in their institution" ON public.appointment_reminders FOR SELECT TO authenticated USING ((institution_id = get_user_institution_id(auth.uid())) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin')));
CREATE POLICY "Owners/admins can manage reminders" ON public.appointment_reminders FOR ALL TO authenticated USING ((institution_id = get_user_institution_id(auth.uid())) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin')));
CREATE POLICY "Service role can manage reminders" ON public.appointment_reminders FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Subscriptions policies
CREATE POLICY "Block anonymous access to subscriptions" ON public.subscriptions FOR SELECT TO anon USING (false);
CREATE POLICY "Owners/admins can view institution subscription" ON public.subscriptions FOR SELECT TO authenticated USING ((institution_id = get_user_institution_id(auth.uid())) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin')));

-- Services policies
CREATE POLICY "Block anonymous access to services" ON public.services FOR SELECT TO anon USING (false);
CREATE POLICY "Users can view services in their institution" ON public.services FOR SELECT TO authenticated USING (institution_id = get_user_institution_id(auth.uid()));
CREATE POLICY "Owners/admins can insert services" ON public.services FOR INSERT TO authenticated WITH CHECK ((institution_id = get_user_institution_id(auth.uid())) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin')));
CREATE POLICY "Owners/admins can update services" ON public.services FOR UPDATE TO authenticated USING ((institution_id = get_user_institution_id(auth.uid())) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin')));
CREATE POLICY "Owners/admins can delete services" ON public.services FOR DELETE TO authenticated USING ((institution_id = get_user_institution_id(auth.uid())) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin')));

-- Institution agents policies
CREATE POLICY "Block anonymous SELECT on institution_agents" ON public.institution_agents FOR SELECT TO anon USING (false);
CREATE POLICY "Block anonymous INSERT on institution_agents" ON public.institution_agents FOR INSERT TO anon WITH CHECK (false);
CREATE POLICY "Block anonymous UPDATE on institution_agents" ON public.institution_agents FOR UPDATE TO anon USING (false);
CREATE POLICY "Block anonymous DELETE on institution_agents" ON public.institution_agents FOR DELETE TO anon USING (false);
CREATE POLICY "Owners/admins can view institution agent" ON public.institution_agents FOR SELECT TO authenticated USING ((institution_id = get_user_institution_id(auth.uid())) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin')));
CREATE POLICY "Owners can update their institution agent" ON public.institution_agents FOR UPDATE TO authenticated USING ((institution_id = get_user_institution_id(auth.uid())) AND has_role(auth.uid(), 'owner'));
CREATE POLICY "Service role can manage institution agents" ON public.institution_agents FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Google calendar connections policies (table removed in earlier migration)
-- CREATE POLICY "Block anon SELECT on google_calendar_connections" ON public.google_calendar_connections FOR SELECT TO anon USING (false);
-- CREATE POLICY "Block anon INSERT on google_calendar_connections" ON public.google_calendar_connections FOR INSERT TO anon WITH CHECK (false);
-- CREATE POLICY "Block anon UPDATE on google_calendar_connections" ON public.google_calendar_connections FOR UPDATE TO anon USING (false);
-- CREATE POLICY "Block anon DELETE on google_calendar_connections" ON public.google_calendar_connections FOR DELETE TO anon USING (false);
-- CREATE POLICY "Institution owners can view calendar connection" ON public.google_calendar_connections FOR SELECT TO authenticated USING ((institution_id = get_user_institution_id(auth.uid())) AND has_role(auth.uid(), 'owner'));
-- CREATE POLICY "Institution owners can insert calendar connection" ON public.google_calendar_connections FOR INSERT TO authenticated WITH CHECK ((institution_id = get_user_institution_id(auth.uid())) AND has_role(auth.uid(), 'owner'));
-- CREATE POLICY "Institution owners can update calendar connection" ON public.google_calendar_connections FOR UPDATE TO authenticated USING ((institution_id = get_user_institution_id(auth.uid())) AND has_role(auth.uid(), 'owner'));
-- CREATE POLICY "Institution owners can delete calendar connection" ON public.google_calendar_connections FOR DELETE TO authenticated USING ((institution_id = get_user_institution_id(auth.uid())) AND has_role(auth.uid(), 'owner'));
-- CREATE POLICY "Service role full access to google_calendar_connections" ON public.google_calendar_connections FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Purchased credits policies
CREATE POLICY "Block anonymous access to purchased_credits" ON public.purchased_credits FOR SELECT TO anon USING (false);
CREATE POLICY "Owners/admins can view purchased credits" ON public.purchased_credits FOR SELECT TO authenticated USING ((institution_id = get_user_institution_id(auth.uid())) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin')));
CREATE POLICY "Service role can manage purchased credits" ON public.purchased_credits FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Contacts policies
CREATE POLICY "Users can view contacts in their institution"
  ON public.contacts FOR SELECT
  TO authenticated
  USING (institution_id IN (
    SELECT institution_id FROM public.profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can insert contacts in their institution"
  ON public.contacts FOR INSERT
  TO authenticated
  WITH CHECK (institution_id IN (
    SELECT institution_id FROM public.profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can update contacts in their institution"
  ON public.contacts FOR UPDATE
  TO authenticated
  USING (institution_id IN (
    SELECT institution_id FROM public.profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can delete contacts in their institution"
  ON public.contacts FOR DELETE
  TO authenticated
  USING (institution_id IN (
    SELECT institution_id FROM public.profiles WHERE id = auth.uid()
  ));

-- Providers policies
CREATE POLICY "Block anonymous access to providers"
  ON public.providers FOR SELECT TO anon USING (false);

CREATE POLICY "Users can view providers in their institution"
  ON public.providers FOR SELECT TO authenticated
  USING (institution_id = get_user_institution_id(auth.uid()));

CREATE POLICY "Owners/admins can manage providers"
  ON public.providers FOR ALL TO authenticated
  USING (
    institution_id = get_user_institution_id(auth.uid())
    AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'))
  )
  WITH CHECK (
    institution_id = get_user_institution_id(auth.uid())
    AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'))
  );

CREATE POLICY "Service role can manage providers"
  ON public.providers FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Provider schedules policies
CREATE POLICY "Block anonymous access to provider_schedules"
  ON public.provider_schedules FOR SELECT TO anon USING (false);

CREATE POLICY "Users can view schedules for their inst providers"
  ON public.provider_schedules FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_schedules.provider_id
      AND p.institution_id = get_user_institution_id(auth.uid())
    )
  );

CREATE POLICY "Owners/admins can manage provider schedules"
  ON public.provider_schedules FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_schedules.provider_id
      AND p.institution_id = get_user_institution_id(auth.uid())
      AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_schedules.provider_id
      AND p.institution_id = get_user_institution_id(auth.uid())
      AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "Service role can manage provider schedules"
  ON public.provider_schedules FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Provider schedule overrides policies
CREATE POLICY "Block anonymous access to provider_schedule_overrides"
  ON public.provider_schedule_overrides FOR SELECT TO anon USING (false);

CREATE POLICY "Users can view overrides for their inst providers"
  ON public.provider_schedule_overrides FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_schedule_overrides.provider_id
      AND p.institution_id = get_user_institution_id(auth.uid())
    )
  );

CREATE POLICY "Owners/admins can manage provider schedule overrides"
  ON public.provider_schedule_overrides FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_schedule_overrides.provider_id
      AND p.institution_id = get_user_institution_id(auth.uid())
      AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_schedule_overrides.provider_id
      AND p.institution_id = get_user_institution_id(auth.uid())
      AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "Service role can manage provider schedule overrides"
  ON public.provider_schedule_overrides FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Calendar events policies
CREATE POLICY "Block anonymous access to calendar_events"
  ON public.calendar_events FOR SELECT TO anon USING (false);

CREATE POLICY "Users can view calendar events in their institution"
  ON public.calendar_events FOR SELECT TO authenticated
  USING (institution_id = get_user_institution_id(auth.uid()));

CREATE POLICY "Owners/admins can manage calendar events"
  ON public.calendar_events FOR ALL TO authenticated
  USING (
    institution_id = get_user_institution_id(auth.uid())
    AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'))
  )
  WITH CHECK (
    institution_id = get_user_institution_id(auth.uid())
    AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'))
  );

CREATE POLICY "Service role can manage calendar events"
  ON public.calendar_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Calendar sync log policies
CREATE POLICY "Block anonymous access to calendar_sync_log"
  ON public.calendar_sync_log FOR SELECT TO anon USING (false);

CREATE POLICY "Users can view sync log for their institution"
  ON public.calendar_sync_log FOR SELECT TO authenticated
  USING (institution_id = get_user_institution_id(auth.uid()));

CREATE POLICY "Service role can manage calendar sync log"
  ON public.calendar_sync_log FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Provider roles policies
CREATE POLICY "Block anonymous access to provider_roles"
  ON public.provider_roles FOR SELECT TO anon USING (false);

CREATE POLICY "Users can view roles in their institution"
  ON public.provider_roles FOR SELECT TO authenticated
  USING (institution_id = get_user_institution_id(auth.uid()));

CREATE POLICY "Owners/admins can manage roles"
  ON public.provider_roles FOR ALL TO authenticated
  USING (
    institution_id = get_user_institution_id(auth.uid())
    AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'))
  )
  WITH CHECK (
    institution_id = get_user_institution_id(auth.uid())
    AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'))
  );

CREATE POLICY "Service role can manage provider roles"
  ON public.provider_roles FOR ALL TO service_role
  USING (true) WITH CHECK (true);
