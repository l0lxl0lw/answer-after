-- ============================================
-- RENAME INSTITUTIONS TO ACCOUNTS, PROFILES TO USERS
-- ============================================
-- Single migration to rename all terminology:
-- - institutions → accounts
-- - profiles → users
-- - user_roles → roles
-- - institution_agents → account_agents
-- - institution_id → account_id (all tables)

-- ============================================
-- STEP 1: DROP ALL RLS POLICIES
-- ============================================

-- Institutions (will be renamed to accounts)
DROP POLICY IF EXISTS "Block anonymous access to institutions" ON public.institutions;
DROP POLICY IF EXISTS "Users can view their institution" ON public.institutions;
DROP POLICY IF EXISTS "Owners can update their institution" ON public.institutions;
DROP POLICY IF EXISTS "Service role can insert institutions" ON public.institutions;

-- Profiles (will be renamed to users)
DROP POLICY IF EXISTS "Block anonymous SELECT on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Owners admins can view institution profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- User roles (will be renamed to roles)
DROP POLICY IF EXISTS "Block anonymous access to user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Service role can manage user_roles" ON public.user_roles;

-- Phone numbers
DROP POLICY IF EXISTS "Block anonymous access to phone_numbers" ON public.phone_numbers;
DROP POLICY IF EXISTS "Users can view phone numbers in their institution" ON public.phone_numbers;
DROP POLICY IF EXISTS "Owners can manage phone numbers" ON public.phone_numbers;

-- Calls
DROP POLICY IF EXISTS "Block anonymous access to calls" ON public.calls;
DROP POLICY IF EXISTS "Owners/admins can view calls in their institution" ON public.calls;
DROP POLICY IF EXISTS "Service role can insert calls" ON public.calls;
DROP POLICY IF EXISTS "Service role can update calls" ON public.calls;

-- Call events
DROP POLICY IF EXISTS "Block anonymous access to call_events" ON public.call_events;
DROP POLICY IF EXISTS "Owners/admins can view call events for their inst calls" ON public.call_events;
DROP POLICY IF EXISTS "Service role can insert call events" ON public.call_events;

-- Call transcripts
DROP POLICY IF EXISTS "Block anonymous access to call_transcripts" ON public.call_transcripts;
DROP POLICY IF EXISTS "Owners/admins can view transcripts for their inst calls" ON public.call_transcripts;
DROP POLICY IF EXISTS "Service role can insert transcripts" ON public.call_transcripts;

-- Appointments
DROP POLICY IF EXISTS "Block anon SELECT on appointments" ON public.appointments;
DROP POLICY IF EXISTS "Block anon INSERT on appointments" ON public.appointments;
DROP POLICY IF EXISTS "Block anon UPDATE on appointments" ON public.appointments;
DROP POLICY IF EXISTS "Block anon DELETE on appointments" ON public.appointments;
DROP POLICY IF EXISTS "Institution owners admins can view appointments" ON public.appointments;
DROP POLICY IF EXISTS "Institution owners admins can insert appointments" ON public.appointments;
DROP POLICY IF EXISTS "Institution owners admins can update appointments" ON public.appointments;
DROP POLICY IF EXISTS "Institution owners admins can delete appointments" ON public.appointments;
DROP POLICY IF EXISTS "Service role full access to appointments" ON public.appointments;

-- Appointment reminders
DROP POLICY IF EXISTS "Block anonymous access to appointment_reminders" ON public.appointment_reminders;
DROP POLICY IF EXISTS "Owners/admins can view reminders in their institution" ON public.appointment_reminders;
DROP POLICY IF EXISTS "Owners/admins can manage reminders" ON public.appointment_reminders;
DROP POLICY IF EXISTS "Service role can manage reminders" ON public.appointment_reminders;

-- Subscriptions
DROP POLICY IF EXISTS "Block anonymous access to subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Owners/admins can view institution subscription" ON public.subscriptions;

-- Services
DROP POLICY IF EXISTS "Block anonymous access to services" ON public.services;
DROP POLICY IF EXISTS "Users can view services in their institution" ON public.services;
DROP POLICY IF EXISTS "Owners/admins can insert services" ON public.services;
DROP POLICY IF EXISTS "Owners/admins can update services" ON public.services;
DROP POLICY IF EXISTS "Owners/admins can delete services" ON public.services;

-- Institution agents (will be renamed to account_agents)
DROP POLICY IF EXISTS "Block anonymous SELECT on institution_agents" ON public.institution_agents;
DROP POLICY IF EXISTS "Block anonymous INSERT on institution_agents" ON public.institution_agents;
DROP POLICY IF EXISTS "Block anonymous UPDATE on institution_agents" ON public.institution_agents;
DROP POLICY IF EXISTS "Block anonymous DELETE on institution_agents" ON public.institution_agents;
DROP POLICY IF EXISTS "Owners/admins can view institution agent" ON public.institution_agents;
DROP POLICY IF EXISTS "Owners can update their institution agent" ON public.institution_agents;
DROP POLICY IF EXISTS "Service role can manage institution agents" ON public.institution_agents;

-- Purchased credits
DROP POLICY IF EXISTS "Block anonymous access to purchased_credits" ON public.purchased_credits;
DROP POLICY IF EXISTS "Owners/admins can view purchased credits" ON public.purchased_credits;
DROP POLICY IF EXISTS "Service role can manage purchased credits" ON public.purchased_credits;

-- Contacts
DROP POLICY IF EXISTS "Users can view contacts in their institution" ON public.contacts;
DROP POLICY IF EXISTS "Users can insert contacts in their institution" ON public.contacts;
DROP POLICY IF EXISTS "Users can update contacts in their institution" ON public.contacts;
DROP POLICY IF EXISTS "Users can delete contacts in their institution" ON public.contacts;

-- Providers
DROP POLICY IF EXISTS "Block anonymous access to providers" ON public.providers;
DROP POLICY IF EXISTS "Users can view providers in their institution" ON public.providers;
DROP POLICY IF EXISTS "Owners/admins can manage providers" ON public.providers;
DROP POLICY IF EXISTS "Service role can manage providers" ON public.providers;

-- Provider schedules
DROP POLICY IF EXISTS "Block anonymous access to provider_schedules" ON public.provider_schedules;
DROP POLICY IF EXISTS "Users can view schedules for their inst providers" ON public.provider_schedules;
DROP POLICY IF EXISTS "Owners/admins can manage provider schedules" ON public.provider_schedules;
DROP POLICY IF EXISTS "Service role can manage provider schedules" ON public.provider_schedules;

-- Provider schedule overrides
DROP POLICY IF EXISTS "Block anonymous access to provider_schedule_overrides" ON public.provider_schedule_overrides;
DROP POLICY IF EXISTS "Users can view overrides for their inst providers" ON public.provider_schedule_overrides;
DROP POLICY IF EXISTS "Owners/admins can manage provider schedule overrides" ON public.provider_schedule_overrides;
DROP POLICY IF EXISTS "Service role can manage provider schedule overrides" ON public.provider_schedule_overrides;

-- Calendar events
DROP POLICY IF EXISTS "Block anonymous access to calendar_events" ON public.calendar_events;
DROP POLICY IF EXISTS "Users can view calendar events in their institution" ON public.calendar_events;
DROP POLICY IF EXISTS "Owners/admins can manage calendar events" ON public.calendar_events;
DROP POLICY IF EXISTS "Service role can manage calendar events" ON public.calendar_events;

-- Calendar sync log
DROP POLICY IF EXISTS "Block anonymous access to calendar_sync_log" ON public.calendar_sync_log;
DROP POLICY IF EXISTS "Users can view sync log for their institution" ON public.calendar_sync_log;
DROP POLICY IF EXISTS "Service role can manage calendar sync log" ON public.calendar_sync_log;

-- Provider roles
DROP POLICY IF EXISTS "Block anonymous access to provider_roles" ON public.provider_roles;
DROP POLICY IF EXISTS "Users can view roles in their institution" ON public.provider_roles;
DROP POLICY IF EXISTS "Owners/admins can manage roles" ON public.provider_roles;
DROP POLICY IF EXISTS "Service role can manage provider roles" ON public.provider_roles;

-- Escalation contacts
DROP POLICY IF EXISTS "Users can view escalation contacts in their institution" ON public.escalation_contacts;
DROP POLICY IF EXISTS "Owners and admins can manage escalation contacts" ON public.escalation_contacts;
DROP POLICY IF EXISTS "Service role full access to escalation contacts" ON public.escalation_contacts;

-- Call intakes
DROP POLICY IF EXISTS "Users can view call intakes in their institution" ON public.call_intakes;
DROP POLICY IF EXISTS "Service role full access to call intakes" ON public.call_intakes;

-- ============================================
-- STEP 2: DROP INDEXES
-- ============================================

DROP INDEX IF EXISTS idx_institutions_slug;
DROP INDEX IF EXISTS idx_profiles_institution;
DROP INDEX IF EXISTS idx_calls_inst_status;
DROP INDEX IF EXISTS idx_calls_created_at;
DROP INDEX IF EXISTS idx_appointments_inst_status;
DROP INDEX IF EXISTS idx_appointments_scheduled;
DROP INDEX IF EXISTS idx_services_inst_active;
DROP INDEX IF EXISTS idx_purchased_credits_inst_id;
DROP INDEX IF EXISTS idx_contacts_inst_status;
DROP INDEX IF EXISTS idx_contacts_inst_phone;
DROP INDEX IF EXISTS idx_contacts_interest;
DROP INDEX IF EXISTS idx_providers_inst;
DROP INDEX IF EXISTS idx_providers_active;
DROP INDEX IF EXISTS idx_calendar_events_inst_time;
DROP INDEX IF EXISTS idx_calendar_sync_log_inst;
DROP INDEX IF EXISTS idx_provider_roles_inst;
DROP INDEX IF EXISTS idx_provider_roles_inst_order;
DROP INDEX IF EXISTS idx_escalation_contacts_institution;
DROP INDEX IF EXISTS idx_escalation_contacts_active_priority;
DROP INDEX IF EXISTS idx_call_intakes_institution;
DROP INDEX IF EXISTS idx_call_intakes_created;
DROP INDEX IF EXISTS idx_call_intakes_urgency;
DROP INDEX IF EXISTS idx_call_intakes_callback_pending;
DROP INDEX IF EXISTS idx_contacts_institution_phone;
DROP INDEX IF EXISTS idx_escalation_contacts_institution_phone;

-- ============================================
-- STEP 3: RENAME TABLES
-- ============================================

ALTER TABLE public.institutions RENAME TO accounts;
ALTER TABLE public.profiles RENAME TO users;
ALTER TABLE public.user_roles RENAME TO roles;
ALTER TABLE public.institution_agents RENAME TO account_agents;

-- ============================================
-- STEP 4: RENAME COLUMNS (institution_id → account_id)
-- ============================================

ALTER TABLE public.users RENAME COLUMN institution_id TO account_id;
ALTER TABLE public.phone_numbers RENAME COLUMN institution_id TO account_id;
ALTER TABLE public.calls RENAME COLUMN institution_id TO account_id;
ALTER TABLE public.appointments RENAME COLUMN institution_id TO account_id;
ALTER TABLE public.appointment_reminders RENAME COLUMN institution_id TO account_id;
ALTER TABLE public.subscriptions RENAME COLUMN institution_id TO account_id;
ALTER TABLE public.services RENAME COLUMN institution_id TO account_id;
ALTER TABLE public.account_agents RENAME COLUMN institution_id TO account_id;
ALTER TABLE public.purchased_credits RENAME COLUMN institution_id TO account_id;
ALTER TABLE public.contacts RENAME COLUMN institution_id TO account_id;
ALTER TABLE public.providers RENAME COLUMN institution_id TO account_id;
ALTER TABLE public.calendar_events RENAME COLUMN institution_id TO account_id;
ALTER TABLE public.calendar_sync_log RENAME COLUMN institution_id TO account_id;
ALTER TABLE public.provider_roles RENAME COLUMN institution_id TO account_id;
ALTER TABLE public.escalation_contacts RENAME COLUMN institution_id TO account_id;
ALTER TABLE public.call_intakes RENAME COLUMN institution_id TO account_id;

-- ============================================
-- STEP 5: UPDATE HELPER FUNCTIONS
-- ============================================

-- Drop old function
DROP FUNCTION IF EXISTS public.get_user_institution_id(uuid);

-- Update has_role functions to use renamed 'roles' table
-- Version 1: takes text parameter
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.roles
    WHERE user_id = _user_id AND role = _role::app_role
  )
$$;

-- Version 2: takes app_role parameter
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Create new function with account name
CREATE OR REPLACE FUNCTION public.get_user_account_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT account_id FROM public.users WHERE id = _user_id
$$;

-- Drop and recreate seed_default_provider_roles function with new parameter name
DROP FUNCTION IF EXISTS public.seed_default_provider_roles(uuid);

CREATE FUNCTION public.seed_default_provider_roles(p_account_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.provider_roles (account_id, name, slug, is_default, display_order)
  VALUES
    (p_account_id, 'Dentist', 'dentist', true, 1),
    (p_account_id, 'Dental Hygienist', 'dental-hygienist', true, 2),
    (p_account_id, 'Dental Assistant', 'dental-assistant', true, 3),
    (p_account_id, 'Specialist', 'specialist', true, 4),
    (p_account_id, 'Receptionist', 'receptionist', true, 5)
  ON CONFLICT (account_id, slug) DO NOTHING;
END;
$$;

-- ============================================
-- STEP 6: RECREATE INDEXES
-- ============================================

CREATE INDEX idx_accounts_slug ON public.accounts(slug);
CREATE INDEX idx_users_account ON public.users(account_id);
CREATE INDEX idx_calls_account_status ON public.calls(account_id, status);
CREATE INDEX idx_calls_account_created_at ON public.calls(account_id, created_at DESC);
CREATE INDEX idx_appointments_account_status ON public.appointments(account_id, status);
CREATE INDEX idx_appointments_scheduled ON public.appointments(account_id, scheduled_start);
CREATE INDEX idx_services_account_active ON public.services(account_id, is_active);
CREATE INDEX idx_purchased_credits_account_id ON public.purchased_credits(account_id);
CREATE INDEX idx_contacts_account_status ON public.contacts(account_id, status);
CREATE INDEX idx_contacts_account_phone ON public.contacts(account_id, phone);
CREATE INDEX idx_contacts_interest ON public.contacts(account_id, interest_level) WHERE status = 'lead';
CREATE INDEX idx_providers_account ON public.providers(account_id);
CREATE INDEX idx_providers_active ON public.providers(account_id, is_active) WHERE is_active = true;
CREATE INDEX idx_calendar_events_account_time ON public.calendar_events(account_id, start_time, end_time);
CREATE INDEX idx_calendar_sync_log_account ON public.calendar_sync_log(account_id, created_at DESC);
CREATE INDEX idx_provider_roles_account ON public.provider_roles(account_id);
CREATE INDEX idx_provider_roles_account_order ON public.provider_roles(account_id, display_order);
CREATE INDEX idx_escalation_contacts_account ON public.escalation_contacts(account_id);
CREATE INDEX idx_escalation_contacts_active_priority ON public.escalation_contacts(account_id, priority) WHERE is_active = true;
CREATE INDEX idx_call_intakes_account ON public.call_intakes(account_id);
CREATE INDEX idx_call_intakes_created ON public.call_intakes(account_id, created_at DESC);
CREATE INDEX idx_call_intakes_urgency ON public.call_intakes(account_id, urgency) WHERE urgency IN ('high', 'emergency');
CREATE INDEX idx_call_intakes_callback_pending ON public.call_intakes(account_id, callback_scheduled_for) WHERE callback_requested = true AND callback_completed_at IS NULL;

-- ============================================
-- STEP 7: RECREATE RLS POLICIES
-- ============================================

-- Accounts policies
CREATE POLICY "Block anonymous access to accounts" ON public.accounts FOR SELECT TO anon USING (false);
CREATE POLICY "Users can view their account" ON public.accounts FOR SELECT TO authenticated USING (id = get_user_account_id(auth.uid()));
CREATE POLICY "Owners can update their account" ON public.accounts FOR UPDATE TO authenticated USING ((id = get_user_account_id(auth.uid())) AND has_role(auth.uid(), 'owner'));
CREATE POLICY "Service role can insert accounts" ON public.accounts FOR INSERT TO service_role WITH CHECK (true);

-- Users policies
CREATE POLICY "Block anonymous SELECT on users" ON public.users FOR SELECT TO anon USING (false);
CREATE POLICY "Users can view own user" ON public.users FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Owners admins can view account users" ON public.users FOR SELECT TO authenticated USING ((account_id IS NOT NULL) AND (account_id = get_user_account_id(auth.uid())) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin')));
CREATE POLICY "Users can insert their own user" ON public.users FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "Users can update their own user" ON public.users FOR UPDATE TO authenticated USING (id = auth.uid());

-- Roles policies
CREATE POLICY "Block anonymous access to roles" ON public.roles FOR SELECT TO anon USING (false);
CREATE POLICY "Users can view their own roles" ON public.roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Service role can manage roles" ON public.roles FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Phone numbers policies
CREATE POLICY "Block anonymous access to phone_numbers" ON public.phone_numbers FOR SELECT TO anon USING (false);
CREATE POLICY "Users can view phone numbers in their account" ON public.phone_numbers FOR SELECT TO authenticated USING (account_id = get_user_account_id(auth.uid()));
CREATE POLICY "Owners can manage phone numbers" ON public.phone_numbers FOR ALL TO authenticated USING ((account_id = get_user_account_id(auth.uid())) AND has_role(auth.uid(), 'owner'));

-- Calls policies
CREATE POLICY "Block anonymous access to calls" ON public.calls FOR SELECT TO anon USING (false);
CREATE POLICY "Owners/admins can view calls in their account" ON public.calls FOR SELECT TO authenticated USING ((account_id = get_user_account_id(auth.uid())) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin')));
CREATE POLICY "Service role can insert calls" ON public.calls FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service role can update calls" ON public.calls FOR UPDATE TO service_role USING (true);

-- Call events policies
CREATE POLICY "Block anonymous access to call_events" ON public.call_events FOR SELECT TO anon USING (false);
CREATE POLICY "Owners/admins can view call events for their account calls" ON public.call_events FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM calls WHERE calls.id = call_events.call_id AND calls.account_id = get_user_account_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'))));
CREATE POLICY "Service role can insert call events" ON public.call_events FOR INSERT TO service_role WITH CHECK (true);

-- Call transcripts policies
CREATE POLICY "Block anonymous access to call_transcripts" ON public.call_transcripts FOR SELECT TO anon USING (false);
CREATE POLICY "Owners/admins can view transcripts for their account calls" ON public.call_transcripts FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM calls WHERE calls.id = call_transcripts.call_id AND calls.account_id = get_user_account_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'))));
CREATE POLICY "Service role can insert transcripts" ON public.call_transcripts FOR INSERT TO service_role WITH CHECK (true);

-- Appointments policies
CREATE POLICY "Block anon SELECT on appointments" ON public.appointments FOR SELECT TO anon USING (false);
CREATE POLICY "Block anon INSERT on appointments" ON public.appointments FOR INSERT TO anon WITH CHECK (false);
CREATE POLICY "Block anon UPDATE on appointments" ON public.appointments FOR UPDATE TO anon USING (false);
CREATE POLICY "Block anon DELETE on appointments" ON public.appointments FOR DELETE TO anon USING (false);
CREATE POLICY "Account owners admins can view appointments" ON public.appointments FOR SELECT TO authenticated USING ((account_id = get_user_account_id(auth.uid())) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin')));
CREATE POLICY "Account owners admins can insert appointments" ON public.appointments FOR INSERT TO authenticated WITH CHECK ((account_id = get_user_account_id(auth.uid())) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin')));
CREATE POLICY "Account owners admins can update appointments" ON public.appointments FOR UPDATE TO authenticated USING ((account_id = get_user_account_id(auth.uid())) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin')));
CREATE POLICY "Account owners admins can delete appointments" ON public.appointments FOR DELETE TO authenticated USING ((account_id = get_user_account_id(auth.uid())) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin')));
CREATE POLICY "Service role full access to appointments" ON public.appointments FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Appointment reminders policies
CREATE POLICY "Block anonymous access to appointment_reminders" ON public.appointment_reminders FOR SELECT TO anon USING (false);
CREATE POLICY "Owners/admins can view reminders in their account" ON public.appointment_reminders FOR SELECT TO authenticated USING ((account_id = get_user_account_id(auth.uid())) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin')));
CREATE POLICY "Owners/admins can manage reminders" ON public.appointment_reminders FOR ALL TO authenticated USING ((account_id = get_user_account_id(auth.uid())) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin')));
CREATE POLICY "Service role can manage reminders" ON public.appointment_reminders FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Subscriptions policies
CREATE POLICY "Block anonymous access to subscriptions" ON public.subscriptions FOR SELECT TO anon USING (false);
CREATE POLICY "Owners/admins can view account subscription" ON public.subscriptions FOR SELECT TO authenticated USING ((account_id = get_user_account_id(auth.uid())) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin')));

-- Services policies
CREATE POLICY "Block anonymous access to services" ON public.services FOR SELECT TO anon USING (false);
CREATE POLICY "Users can view services in their account" ON public.services FOR SELECT TO authenticated USING (account_id = get_user_account_id(auth.uid()));
CREATE POLICY "Owners/admins can insert services" ON public.services FOR INSERT TO authenticated WITH CHECK ((account_id = get_user_account_id(auth.uid())) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin')));
CREATE POLICY "Owners/admins can update services" ON public.services FOR UPDATE TO authenticated USING ((account_id = get_user_account_id(auth.uid())) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin')));
CREATE POLICY "Owners/admins can delete services" ON public.services FOR DELETE TO authenticated USING ((account_id = get_user_account_id(auth.uid())) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin')));

-- Account agents policies
CREATE POLICY "Block anonymous SELECT on account_agents" ON public.account_agents FOR SELECT TO anon USING (false);
CREATE POLICY "Block anonymous INSERT on account_agents" ON public.account_agents FOR INSERT TO anon WITH CHECK (false);
CREATE POLICY "Block anonymous UPDATE on account_agents" ON public.account_agents FOR UPDATE TO anon USING (false);
CREATE POLICY "Block anonymous DELETE on account_agents" ON public.account_agents FOR DELETE TO anon USING (false);
CREATE POLICY "Owners/admins can view account agent" ON public.account_agents FOR SELECT TO authenticated USING ((account_id = get_user_account_id(auth.uid())) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin')));
CREATE POLICY "Owners can update their account agent" ON public.account_agents FOR UPDATE TO authenticated USING ((account_id = get_user_account_id(auth.uid())) AND has_role(auth.uid(), 'owner'));
CREATE POLICY "Service role can manage account agents" ON public.account_agents FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Purchased credits policies
CREATE POLICY "Block anonymous access to purchased_credits" ON public.purchased_credits FOR SELECT TO anon USING (false);
CREATE POLICY "Owners/admins can view purchased credits" ON public.purchased_credits FOR SELECT TO authenticated USING ((account_id = get_user_account_id(auth.uid())) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin')));
CREATE POLICY "Service role can manage purchased credits" ON public.purchased_credits FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Contacts policies
CREATE POLICY "Users can view contacts in their account"
  ON public.contacts FOR SELECT
  TO authenticated
  USING (account_id IN (
    SELECT account_id FROM public.users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can insert contacts in their account"
  ON public.contacts FOR INSERT
  TO authenticated
  WITH CHECK (account_id IN (
    SELECT account_id FROM public.users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can update contacts in their account"
  ON public.contacts FOR UPDATE
  TO authenticated
  USING (account_id IN (
    SELECT account_id FROM public.users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can delete contacts in their account"
  ON public.contacts FOR DELETE
  TO authenticated
  USING (account_id IN (
    SELECT account_id FROM public.users WHERE id = auth.uid()
  ));

-- Providers policies
CREATE POLICY "Block anonymous access to providers"
  ON public.providers FOR SELECT TO anon USING (false);

CREATE POLICY "Users can view providers in their account"
  ON public.providers FOR SELECT TO authenticated
  USING (account_id = get_user_account_id(auth.uid()));

CREATE POLICY "Owners/admins can manage providers"
  ON public.providers FOR ALL TO authenticated
  USING (
    account_id = get_user_account_id(auth.uid())
    AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'))
  )
  WITH CHECK (
    account_id = get_user_account_id(auth.uid())
    AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'))
  );

CREATE POLICY "Service role can manage providers"
  ON public.providers FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Provider schedules policies
CREATE POLICY "Block anonymous access to provider_schedules"
  ON public.provider_schedules FOR SELECT TO anon USING (false);

CREATE POLICY "Users can view schedules for their account providers"
  ON public.provider_schedules FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_schedules.provider_id
      AND p.account_id = get_user_account_id(auth.uid())
    )
  );

CREATE POLICY "Owners/admins can manage provider schedules"
  ON public.provider_schedules FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_schedules.provider_id
      AND p.account_id = get_user_account_id(auth.uid())
      AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_schedules.provider_id
      AND p.account_id = get_user_account_id(auth.uid())
      AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "Service role can manage provider schedules"
  ON public.provider_schedules FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Provider schedule overrides policies
CREATE POLICY "Block anonymous access to provider_schedule_overrides"
  ON public.provider_schedule_overrides FOR SELECT TO anon USING (false);

CREATE POLICY "Users can view overrides for their account providers"
  ON public.provider_schedule_overrides FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_schedule_overrides.provider_id
      AND p.account_id = get_user_account_id(auth.uid())
    )
  );

CREATE POLICY "Owners/admins can manage provider schedule overrides"
  ON public.provider_schedule_overrides FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_schedule_overrides.provider_id
      AND p.account_id = get_user_account_id(auth.uid())
      AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_schedule_overrides.provider_id
      AND p.account_id = get_user_account_id(auth.uid())
      AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "Service role can manage provider schedule overrides"
  ON public.provider_schedule_overrides FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Calendar events policies
CREATE POLICY "Block anonymous access to calendar_events"
  ON public.calendar_events FOR SELECT TO anon USING (false);

CREATE POLICY "Users can view calendar events in their account"
  ON public.calendar_events FOR SELECT TO authenticated
  USING (account_id = get_user_account_id(auth.uid()));

CREATE POLICY "Owners/admins can manage calendar events"
  ON public.calendar_events FOR ALL TO authenticated
  USING (
    account_id = get_user_account_id(auth.uid())
    AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'))
  )
  WITH CHECK (
    account_id = get_user_account_id(auth.uid())
    AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'))
  );

CREATE POLICY "Service role can manage calendar events"
  ON public.calendar_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Calendar sync log policies
CREATE POLICY "Block anonymous access to calendar_sync_log"
  ON public.calendar_sync_log FOR SELECT TO anon USING (false);

CREATE POLICY "Users can view sync log for their account"
  ON public.calendar_sync_log FOR SELECT TO authenticated
  USING (account_id = get_user_account_id(auth.uid()));

CREATE POLICY "Service role can manage calendar sync log"
  ON public.calendar_sync_log FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Provider roles policies
CREATE POLICY "Block anonymous access to provider_roles"
  ON public.provider_roles FOR SELECT TO anon USING (false);

CREATE POLICY "Users can view roles in their account"
  ON public.provider_roles FOR SELECT TO authenticated
  USING (account_id = get_user_account_id(auth.uid()));

CREATE POLICY "Owners/admins can manage roles"
  ON public.provider_roles FOR ALL TO authenticated
  USING (
    account_id = get_user_account_id(auth.uid())
    AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'))
  )
  WITH CHECK (
    account_id = get_user_account_id(auth.uid())
    AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'))
  );

CREATE POLICY "Service role can manage provider roles"
  ON public.provider_roles FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Escalation contacts policies
CREATE POLICY "Users can view escalation contacts in their account"
  ON public.escalation_contacts FOR SELECT TO authenticated
  USING (account_id = get_user_account_id(auth.uid()));

CREATE POLICY "Owners and admins can manage escalation contacts"
  ON public.escalation_contacts FOR ALL TO authenticated
  USING (
    account_id = get_user_account_id(auth.uid())
    AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'))
  )
  WITH CHECK (
    account_id = get_user_account_id(auth.uid())
    AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'))
  );

CREATE POLICY "Service role full access to escalation contacts"
  ON public.escalation_contacts FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Call intakes policies
CREATE POLICY "Users can view call intakes in their account"
  ON public.call_intakes FOR SELECT TO authenticated
  USING (account_id = get_user_account_id(auth.uid()));

CREATE POLICY "Service role full access to call intakes"
  ON public.call_intakes FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================
-- STEP 8: UPDATE UNIQUE CONSTRAINTS
-- ============================================

-- Update unique constraint on escalation_contacts
ALTER TABLE public.escalation_contacts DROP CONSTRAINT IF EXISTS escalation_contacts_institution_id_phone_key;
ALTER TABLE public.escalation_contacts ADD CONSTRAINT escalation_contacts_account_id_phone_key UNIQUE (account_id, phone);

-- Update unique constraint on provider_roles
ALTER TABLE public.provider_roles DROP CONSTRAINT IF EXISTS provider_roles_institution_id_slug_key;
ALTER TABLE public.provider_roles ADD CONSTRAINT provider_roles_account_id_slug_key UNIQUE (account_id, slug);

-- ============================================
-- STEP 9: UPDATE TABLE COMMENTS
-- ============================================

COMMENT ON TABLE public.accounts IS 'Business accounts (formerly institutions/organizations)';
COMMENT ON TABLE public.users IS 'User profiles linked to accounts';
COMMENT ON TABLE public.roles IS 'User role assignments';
COMMENT ON TABLE public.account_agents IS 'AI agent configuration per account';

COMMENT ON COLUMN public.accounts.business_phone_number IS 'Original business phone number provided by user during onboarding';
COMMENT ON COLUMN public.accounts.workflow_config IS 'Lead recovery workflow configuration';
