-- ============================================
-- ANSWERAFTER DATABASE SCHEMA
-- Initial consolidated schema
-- ============================================

-- ============= ENUMS =============
CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'staff');
CREATE TYPE public.appointment_status AS ENUM ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show');
CREATE TYPE public.call_outcome AS ENUM ('booked', 'callback_requested', 'information_provided', 'escalated', 'no_action', 'voicemail');
CREATE TYPE public.call_status AS ENUM ('active', 'completed', 'failed', 'voicemail');

-- ============= TABLES =============

-- Organizations table
CREATE TABLE public.organizations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  timezone text NOT NULL DEFAULT 'America/New_York',
  business_hours_start text,
  business_hours_end text,
  business_hours_schedule jsonb DEFAULT '{"friday": {"end": "17:00", "start": "09:00", "enabled": true}, "monday": {"end": "17:00", "start": "09:00", "enabled": true}, "sunday": {"end": "17:00", "start": "09:00", "enabled": false}, "tuesday": {"end": "17:00", "start": "09:00", "enabled": true}, "saturday": {"end": "17:00", "start": "09:00", "enabled": false}, "thursday": {"end": "17:00", "start": "09:00", "enabled": true}, "wednesday": {"end": "17:00", "start": "09:00", "enabled": true}}'::jsonb,
  notification_email text,
  notification_phone text,
  business_phone_number text,
  emergency_keywords text[],
  twilio_subaccount_sid text,
  twilio_subaccount_auth_token text,
  is_onboarding_complete boolean NOT NULL DEFAULT false,
  onboarding_completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.organizations.business_phone_number IS 'Original business phone number provided by user during onboarding';

-- Profiles table (linked to auth.users)
CREATE TABLE public.profiles (
  id uuid NOT NULL PRIMARY KEY,
  organization_id uuid REFERENCES public.organizations(id),
  email text NOT NULL,
  full_name text NOT NULL,
  phone text,
  avatar_url text,
  is_active boolean NOT NULL DEFAULT true,
  email_verified boolean NOT NULL DEFAULT false,
  phone_verified boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- User roles table
CREATE TABLE public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Phone numbers table
CREATE TABLE public.phone_numbers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  twilio_sid text,
  phone_number text NOT NULL,
  friendly_name text,
  is_active boolean NOT NULL DEFAULT true,
  is_after_hours_only boolean NOT NULL DEFAULT false,
  is_shared boolean NOT NULL DEFAULT false,
  provisioned_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Calls table
CREATE TABLE public.calls (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  phone_number_id uuid REFERENCES public.phone_numbers(id),
  twilio_call_sid text,
  caller_phone text NOT NULL,
  caller_name text,
  status call_status NOT NULL DEFAULT 'active',
  outcome call_outcome,
  duration_seconds integer,
  recording_url text,
  summary text,
  is_emergency boolean NOT NULL DEFAULT false,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  ended_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Call events table
CREATE TABLE public.call_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  call_id uuid NOT NULL REFERENCES public.calls(id),
  event_type text NOT NULL,
  event_data jsonb,
  ai_prompt text,
  ai_response text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Call transcripts table
CREATE TABLE public.call_transcripts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  call_id uuid NOT NULL REFERENCES public.calls(id),
  speaker text NOT NULL,
  content text NOT NULL,
  confidence numeric,
  timestamp_ms integer,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Appointments table
CREATE TABLE public.appointments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  call_id uuid REFERENCES public.calls(id),
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  customer_address text,
  issue_description text NOT NULL,
  scheduled_start timestamp with time zone NOT NULL,
  scheduled_end timestamp with time zone NOT NULL,
  status appointment_status NOT NULL DEFAULT 'scheduled',
  is_emergency boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Appointment reminders table
CREATE TABLE public.appointment_reminders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id uuid NOT NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  reminder_number integer NOT NULL,
  scheduled_time timestamp with time zone NOT NULL,
  reminder_type text NOT NULL DEFAULT 'call',
  status text NOT NULL DEFAULT 'pending',
  response text,
  twilio_call_sid text,
  call_duration_seconds integer,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (appointment_id, reminder_number)
);

-- Subscriptions table
CREATE TABLE public.subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) UNIQUE,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan text NOT NULL DEFAULT 'core',
  status text NOT NULL DEFAULT 'trial',
  total_credits integer NOT NULL DEFAULT 250,
  used_credits integer NOT NULL DEFAULT 0,
  current_period_start timestamp with time zone,
  current_period_end timestamp with time zone,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Subscription tiers table
CREATE TABLE public.subscription_tiers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL,
  price_cents integer NOT NULL DEFAULT 0,
  period text NOT NULL DEFAULT '/month',
  credits integer NOT NULL DEFAULT 0,
  credits_cost_per_thousand numeric,
  phone_lines integer NOT NULL DEFAULT 1,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  has_custom_agent boolean NOT NULL DEFAULT false,
  has_outbound_reminders boolean NOT NULL DEFAULT false,
  has_call_recordings boolean NOT NULL DEFAULT false,
  has_api_access boolean NOT NULL DEFAULT false,
  has_priority_support boolean NOT NULL DEFAULT false,
  has_custom_ai_training boolean NOT NULL DEFAULT false,
  has_sla_guarantee boolean NOT NULL DEFAULT false,
  has_hipaa_compliance boolean NOT NULL DEFAULT false,
  support_level text NOT NULL DEFAULT 'standard',
  stripe_monthly_price_id text,
  is_active boolean NOT NULL DEFAULT true,
  is_visible boolean NOT NULL DEFAULT true,
  is_popular boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Services table
CREATE TABLE public.services (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'routine',
  price_cents integer NOT NULL DEFAULT 0,
  duration_minutes integer NOT NULL DEFAULT 60,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Organization agents table
CREATE TABLE public.organization_agents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) UNIQUE,
  elevenlabs_agent_id text,
  context text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Google calendar connections table
CREATE TABLE public.google_calendar_connections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) UNIQUE,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  token_expires_at timestamp with time zone NOT NULL,
  connected_email text,
  selected_calendars text[] DEFAULT '{}'::text[],
  connected_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Credit config table
CREATE TABLE public.credit_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_key text NOT NULL UNIQUE,
  config_value numeric NOT NULL,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Purchased credits table
CREATE TABLE public.purchased_credits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  stripe_payment_intent_id text,
  credits_purchased integer NOT NULL,
  credits_remaining integer NOT NULL,
  price_cents integer NOT NULL,
  purchased_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Prompt templates table
CREATE TABLE public.prompt_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  template text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Verification codes table
CREATE TABLE public.verification_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  type text NOT NULL,
  email text,
  phone text,
  code text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  verified_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Idempotency keys table
CREATE TABLE public.idempotency_keys (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  result jsonb,
  processed_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ============= FUNCTIONS =============

-- Function to update updated_at column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Function to handle new user creation (creates profile)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$;

-- Function to get user's organization ID
CREATE OR REPLACE FUNCTION public.get_user_organization_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT organization_id FROM public.profiles WHERE id = _user_id
$$;

-- Function to check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Function to cleanup old idempotency keys
CREATE OR REPLACE FUNCTION public.cleanup_old_idempotency_keys()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.idempotency_keys
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$;

-- ============= INDEXES =============
CREATE INDEX idx_appointment_reminders_appointment ON public.appointment_reminders USING btree (appointment_id);
CREATE INDEX idx_appointment_reminders_scheduled ON public.appointment_reminders USING btree (scheduled_time, status);
CREATE INDEX idx_purchased_credits_org_id ON public.purchased_credits USING btree (organization_id);
CREATE INDEX idx_purchased_credits_remaining ON public.purchased_credits USING btree (credits_remaining) WHERE (credits_remaining > 0);
CREATE INDEX idx_idempotency_keys_key ON public.idempotency_keys(key);
CREATE INDEX idx_idempotency_keys_created_at ON public.idempotency_keys(created_at);

-- ============= ENABLE RLS =============
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phone_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_calendar_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchased_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

-- ============= RLS POLICIES =============

-- Organizations policies
CREATE POLICY "Block anonymous access to organizations" ON public.organizations FOR SELECT TO anon USING (false);
CREATE POLICY "Users can view their organization" ON public.organizations FOR SELECT TO authenticated USING (id = get_user_organization_id(auth.uid()));
CREATE POLICY "Owners can update their organization" ON public.organizations FOR UPDATE TO authenticated USING ((id = get_user_organization_id(auth.uid())) AND has_role(auth.uid(), 'owner'));
CREATE POLICY "Service role can insert organizations" ON public.organizations FOR INSERT TO service_role WITH CHECK (true);

-- Profiles policies
CREATE POLICY "Block anonymous SELECT on profiles" ON public.profiles FOR SELECT TO anon USING (false);
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Owners admins can view org profiles" ON public.profiles FOR SELECT TO authenticated USING ((organization_id IS NOT NULL) AND (organization_id = get_user_organization_id(auth.uid())) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin')));
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());

-- User roles policies
CREATE POLICY "Block anonymous access to user_roles" ON public.user_roles FOR SELECT TO anon USING (false);
CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Service role can manage user_roles" ON public.user_roles FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Phone numbers policies
CREATE POLICY "Block anonymous access to phone_numbers" ON public.phone_numbers FOR SELECT TO anon USING (false);
CREATE POLICY "Users can view phone numbers in their organization" ON public.phone_numbers FOR SELECT TO authenticated USING (organization_id = get_user_organization_id(auth.uid()));
CREATE POLICY "Owners can manage phone numbers" ON public.phone_numbers FOR ALL TO authenticated USING ((organization_id = get_user_organization_id(auth.uid())) AND has_role(auth.uid(), 'owner'));

-- Calls policies
CREATE POLICY "Block anonymous access to calls" ON public.calls FOR SELECT TO anon USING (false);
CREATE POLICY "Owners/admins can view calls in their organization" ON public.calls FOR SELECT TO authenticated USING ((organization_id = get_user_organization_id(auth.uid())) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin')));
CREATE POLICY "Service role can insert calls" ON public.calls FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service role can update calls" ON public.calls FOR UPDATE TO service_role USING (true);

-- Call events policies
CREATE POLICY "Block anonymous access to call_events" ON public.call_events FOR SELECT TO anon USING (false);
CREATE POLICY "Owners/admins can view call events for their org calls" ON public.call_events FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM calls WHERE calls.id = call_events.call_id AND calls.organization_id = get_user_organization_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'))));
CREATE POLICY "Service role can insert call events" ON public.call_events FOR INSERT TO service_role WITH CHECK (true);

-- Call transcripts policies
CREATE POLICY "Block anonymous access to call_transcripts" ON public.call_transcripts FOR SELECT TO anon USING (false);
CREATE POLICY "Owners/admins can view transcripts for their org calls" ON public.call_transcripts FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM calls WHERE calls.id = call_transcripts.call_id AND calls.organization_id = get_user_organization_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'))));
CREATE POLICY "Service role can insert transcripts" ON public.call_transcripts FOR INSERT TO service_role WITH CHECK (true);

-- Appointments policies
CREATE POLICY "Block anon SELECT on appointments" ON public.appointments FOR SELECT TO anon USING (false);
CREATE POLICY "Block anon INSERT on appointments" ON public.appointments FOR INSERT TO anon WITH CHECK (false);
CREATE POLICY "Block anon UPDATE on appointments" ON public.appointments FOR UPDATE TO anon USING (false);
CREATE POLICY "Block anon DELETE on appointments" ON public.appointments FOR DELETE TO anon USING (false);
CREATE POLICY "Org owners admins can view appointments" ON public.appointments FOR SELECT TO authenticated USING ((organization_id = get_user_organization_id(auth.uid())) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin')));
CREATE POLICY "Org owners admins can insert appointments" ON public.appointments FOR INSERT TO authenticated WITH CHECK ((organization_id = get_user_organization_id(auth.uid())) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin')));
CREATE POLICY "Org owners admins can update appointments" ON public.appointments FOR UPDATE TO authenticated USING ((organization_id = get_user_organization_id(auth.uid())) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin')));
CREATE POLICY "Org owners admins can delete appointments" ON public.appointments FOR DELETE TO authenticated USING ((organization_id = get_user_organization_id(auth.uid())) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin')));
CREATE POLICY "Service role full access to appointments" ON public.appointments FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Appointment reminders policies
CREATE POLICY "Block anonymous access to appointment_reminders" ON public.appointment_reminders FOR SELECT TO anon USING (false);
CREATE POLICY "Owners/admins can view reminders in their organization" ON public.appointment_reminders FOR SELECT TO authenticated USING ((organization_id = get_user_organization_id(auth.uid())) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin')));
CREATE POLICY "Owners/admins can manage reminders" ON public.appointment_reminders FOR ALL TO authenticated USING ((organization_id = get_user_organization_id(auth.uid())) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin')));
CREATE POLICY "Service role can manage reminders" ON public.appointment_reminders FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Subscriptions policies
CREATE POLICY "Block anonymous access to subscriptions" ON public.subscriptions FOR SELECT TO anon USING (false);
CREATE POLICY "Owners/admins can view organization subscription" ON public.subscriptions FOR SELECT TO authenticated USING ((organization_id = get_user_organization_id(auth.uid())) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin')));

-- Subscription tiers policies
CREATE POLICY "Anyone can view active visible tiers" ON public.subscription_tiers FOR SELECT TO anon USING ((is_active = true) AND (is_visible = true));
CREATE POLICY "Authenticated users can view active visible tiers" ON public.subscription_tiers FOR SELECT TO authenticated USING ((is_active = true) AND (is_visible = true));
CREATE POLICY "Block anonymous writes to subscription_tiers" ON public.subscription_tiers FOR INSERT TO anon WITH CHECK (false);
CREATE POLICY "Block anonymous updates to subscription_tiers" ON public.subscription_tiers FOR UPDATE TO anon USING (false);
CREATE POLICY "Block anonymous deletes to subscription_tiers" ON public.subscription_tiers FOR DELETE TO anon USING (false);

-- Services policies
CREATE POLICY "Block anonymous access to services" ON public.services FOR SELECT TO anon USING (false);
CREATE POLICY "Users can view services in their organization" ON public.services FOR SELECT TO authenticated USING (organization_id = get_user_organization_id(auth.uid()));
CREATE POLICY "Owners/admins can insert services" ON public.services FOR INSERT TO authenticated WITH CHECK ((organization_id = get_user_organization_id(auth.uid())) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin')));
CREATE POLICY "Owners/admins can update services" ON public.services FOR UPDATE TO authenticated USING ((organization_id = get_user_organization_id(auth.uid())) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin')));
CREATE POLICY "Owners/admins can delete services" ON public.services FOR DELETE TO authenticated USING ((organization_id = get_user_organization_id(auth.uid())) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin')));

-- Organization agents policies
CREATE POLICY "Block anonymous SELECT on organization_agents" ON public.organization_agents FOR SELECT TO anon USING (false);
CREATE POLICY "Block anonymous INSERT on organization_agents" ON public.organization_agents FOR INSERT TO anon WITH CHECK (false);
CREATE POLICY "Block anonymous UPDATE on organization_agents" ON public.organization_agents FOR UPDATE TO anon USING (false);
CREATE POLICY "Block anonymous DELETE on organization_agents" ON public.organization_agents FOR DELETE TO anon USING (false);
CREATE POLICY "Owners/admins can view organization agent" ON public.organization_agents FOR SELECT TO authenticated USING ((organization_id = get_user_organization_id(auth.uid())) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin')));
CREATE POLICY "Owners can update their organization agent" ON public.organization_agents FOR UPDATE TO authenticated USING ((organization_id = get_user_organization_id(auth.uid())) AND has_role(auth.uid(), 'owner'));
CREATE POLICY "Service role can manage organization agents" ON public.organization_agents FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Google calendar connections policies
CREATE POLICY "Block anon SELECT on google_calendar_connections" ON public.google_calendar_connections FOR SELECT TO anon USING (false);
CREATE POLICY "Block anon INSERT on google_calendar_connections" ON public.google_calendar_connections FOR INSERT TO anon WITH CHECK (false);
CREATE POLICY "Block anon UPDATE on google_calendar_connections" ON public.google_calendar_connections FOR UPDATE TO anon USING (false);
CREATE POLICY "Block anon DELETE on google_calendar_connections" ON public.google_calendar_connections FOR DELETE TO anon USING (false);
CREATE POLICY "Org owners can view calendar connection" ON public.google_calendar_connections FOR SELECT TO authenticated USING ((organization_id = get_user_organization_id(auth.uid())) AND has_role(auth.uid(), 'owner'));
CREATE POLICY "Org owners can insert calendar connection" ON public.google_calendar_connections FOR INSERT TO authenticated WITH CHECK ((organization_id = get_user_organization_id(auth.uid())) AND has_role(auth.uid(), 'owner'));
CREATE POLICY "Org owners can update calendar connection" ON public.google_calendar_connections FOR UPDATE TO authenticated USING ((organization_id = get_user_organization_id(auth.uid())) AND has_role(auth.uid(), 'owner'));
CREATE POLICY "Org owners can delete calendar connection" ON public.google_calendar_connections FOR DELETE TO authenticated USING ((organization_id = get_user_organization_id(auth.uid())) AND has_role(auth.uid(), 'owner'));
CREATE POLICY "Service role full access to google_calendar_connections" ON public.google_calendar_connections FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Credit config policies
CREATE POLICY "Anyone can view credit config" ON public.credit_config FOR SELECT USING (true);

-- Purchased credits policies
CREATE POLICY "Block anonymous access to purchased_credits" ON public.purchased_credits FOR SELECT TO anon USING (false);
CREATE POLICY "Owners/admins can view purchased credits" ON public.purchased_credits FOR SELECT TO authenticated USING ((organization_id = get_user_organization_id(auth.uid())) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin')));
CREATE POLICY "Service role can manage purchased credits" ON public.purchased_credits FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Prompt templates policies
CREATE POLICY "Authenticated users can view active templates" ON public.prompt_templates FOR SELECT TO authenticated USING (is_active = true);
CREATE POLICY "Block anonymous writes to prompt_templates" ON public.prompt_templates FOR INSERT TO anon WITH CHECK (false);
CREATE POLICY "Block anonymous updates to prompt_templates" ON public.prompt_templates FOR UPDATE TO anon USING (false);
CREATE POLICY "Block anonymous deletes to prompt_templates" ON public.prompt_templates FOR DELETE TO anon USING (false);
CREATE POLICY "Service role can manage templates" ON public.prompt_templates FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Verification codes policies
CREATE POLICY "Block anonymous access to verification_codes" ON public.verification_codes FOR SELECT TO anon USING (false);
CREATE POLICY "Service role can manage verification codes" ON public.verification_codes FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Idempotency keys policies
CREATE POLICY "Service role full access to idempotency_keys" ON public.idempotency_keys FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Block all other access to idempotency_keys" ON public.idempotency_keys FOR ALL USING (false) WITH CHECK (false);

-- ============= SEED DATA =============

-- Subscription tiers
INSERT INTO public.subscription_tiers (
  plan_id,
  name,
  description,
  price_cents,
  period,
  credits,
  phone_lines,
  features,
  has_custom_agent,
  has_outbound_reminders,
  has_call_recordings,
  has_api_access,
  has_priority_support,
  has_custom_ai_training,
  has_sla_guarantee,
  support_level,
  is_active,
  is_visible,
  is_popular,
  display_order
) VALUES
  -- Core Plan
  (
    'core',
    'Core',
    'Light usage coverage for occasional after-hours calls',
    2900,
    '/mo',
    250,
    1,
    '["24/7 AI call answering", "Email support"]'::jsonb,
    false,
    false,
    true,
    false,
    false,
    false,
    false,
    'email',
    true,
    true,
    false,
    1
  ),
  -- Growth Plan
  (
    'growth',
    'Growth',
    'Reliable weekly coverage for growing practices',
    9900,
    '/mo',
    600,
    1,
    '["Everything in Core", "Define services for your agent", "Priority email support"]'::jsonb,
    true,
    false,
    true,
    false,
    true,
    false,
    false,
    'priority_email',
    true,
    true,
    false,
    2
  ),
  -- Pro Plan (Most Popular)
  (
    'pro',
    'Pro',
    'Extended coverage for busy practices',
    19900,
    '/mo',
    1400,
    1,
    '["Everything in Growth", "Reminder rules included", "Define context for your agent", "Priority support"]'::jsonb,
    true,
    true,
    true,
    false,
    true,
    true,
    false,
    'priority',
    true,
    true,
    true,
    3
  ),
  -- Business Plan (Best for High Volume)
  (
    'business',
    'Business',
    'Full month coverage for high-volume practices',
    49900,
    '/mo',
    3000,
    2,
    '["Everything in Pro", "Dedicated support", "Advanced reporting"]'::jsonb,
    true,
    true,
    true,
    true,
    true,
    true,
    false,
    'dedicated',
    true,
    true,
    false,
    4
  ),
  -- Enterprise Plan
  (
    'enterprise',
    'Enterprise',
    'Custom limits, onboarding, and support',
    0,
    '',
    0,
    0,
    '["Everything in Business", "Custom usage limits", "Dedicated onboarding", "Custom integrations", "SLA guarantee", "Enterprise support"]'::jsonb,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    'enterprise',
    true,
    true,
    false,
    5
  );

-- ============= STORAGE BUCKETS =============
INSERT INTO storage.buckets (id, name, public) VALUES ('tts-audio', 'tts-audio', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('greetings', 'greetings', true);

-- ============= TRIGGERS =============

-- Trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
