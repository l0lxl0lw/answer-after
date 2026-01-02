-- ============================================
-- Native Calendar System with Multi-Provider Support
-- ============================================
-- Adds providers, scheduling, and unified calendar events
-- for dental office multi-provider booking

-- ============================================
-- PROVIDERS TABLE
-- ============================================
-- Staff members who can be booked (dentists, hygienists, etc.)

CREATE TABLE public.providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,  -- Optional link to AnswerAfter user
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT NOT NULL,  -- 'dentist', 'hygienist', 'assistant', etc.
  color TEXT DEFAULT '#3b82f6',  -- For calendar display
  is_active BOOLEAN NOT NULL DEFAULT true,
  external_id TEXT,  -- ID from dental PMS for sync
  google_calendar_id TEXT,  -- Provider's Google Calendar ID
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_providers_org ON public.providers(organization_id);
CREATE INDEX idx_providers_active ON public.providers(organization_id, is_active) WHERE is_active = true;

-- ============================================
-- PROVIDER SCHEDULES TABLE
-- ============================================
-- Recurring weekly availability for each provider

CREATE TABLE public.provider_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),  -- 0=Sunday, 6=Saturday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT valid_time_range CHECK (end_time > start_time),
  UNIQUE(provider_id, day_of_week, start_time)
);

CREATE INDEX idx_provider_schedules_provider ON public.provider_schedules(provider_id);

-- ============================================
-- PROVIDER SCHEDULE OVERRIDES TABLE
-- ============================================
-- Date-specific exceptions (vacations, extra hours, etc.)

CREATE TABLE public.provider_schedule_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  override_date DATE NOT NULL,
  start_time TIME,  -- NULL if blocking entire day
  end_time TIME,    -- NULL if blocking entire day
  is_available BOOLEAN NOT NULL,  -- false = blocked, true = extra availability
  reason TEXT,  -- 'vacation', 'conference', 'extra hours', etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT valid_override_time CHECK (
    (start_time IS NULL AND end_time IS NULL) OR
    (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time)
  ),
  UNIQUE(provider_id, override_date, start_time)
);

CREATE INDEX idx_provider_overrides_date ON public.provider_schedule_overrides(provider_id, override_date);

-- ============================================
-- CALENDAR EVENTS TABLE
-- ============================================
-- Unified calendar storage for all sources (native, Google, PMS)

CREATE TABLE public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES public.providers(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE,

  -- Event details
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'tentative', 'cancelled')),
  color TEXT,

  -- Customer info (for display without appointment lookup)
  customer_name TEXT,
  customer_phone TEXT,

  -- Sync tracking
  source TEXT NOT NULL CHECK (source IN ('native', 'google', 'nexhealth', 'other_pms')),
  external_id TEXT,  -- ID from external system
  external_calendar_id TEXT,  -- Which external calendar
  sync_status TEXT NOT NULL DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending_push', 'pending_pull', 'conflict')),
  last_synced_at TIMESTAMPTZ,
  external_updated_at TIMESTAMPTZ,  -- For conflict detection

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT valid_event_time CHECK (end_time > start_time),
  UNIQUE(organization_id, source, external_id)
);

CREATE INDEX idx_calendar_events_org_time ON public.calendar_events(organization_id, start_time, end_time);
CREATE INDEX idx_calendar_events_provider ON public.calendar_events(provider_id, start_time);
CREATE INDEX idx_calendar_events_sync ON public.calendar_events(sync_status) WHERE sync_status != 'synced';
CREATE INDEX idx_calendar_events_appointment ON public.calendar_events(appointment_id) WHERE appointment_id IS NOT NULL;

-- ============================================
-- CALENDAR SYNC LOG TABLE
-- ============================================
-- Audit trail for sync operations

CREATE TABLE public.calendar_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('pull', 'push', 'conflict_resolved', 'error')),
  event_id UUID REFERENCES public.calendar_events(id) ON DELETE SET NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_calendar_sync_log_org ON public.calendar_sync_log(organization_id, created_at DESC);

-- ============================================
-- MODIFY EXISTING TABLES
-- ============================================

-- Add provider and calendar event references to appointments
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS provider_id UUID REFERENCES public.providers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS calendar_event_id UUID REFERENCES public.calendar_events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_provider ON public.appointments(provider_id);
CREATE INDEX IF NOT EXISTS idx_appointments_calendar_event ON public.appointments(calendar_event_id);

-- Add provider roles to services (which provider types can perform this service)
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS provider_roles TEXT[] DEFAULT '{}';

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_schedule_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_sync_log ENABLE ROW LEVEL SECURITY;

-- Providers policies
CREATE POLICY "Block anonymous access to providers"
  ON public.providers FOR SELECT TO anon USING (false);

CREATE POLICY "Users can view providers in their organization"
  ON public.providers FOR SELECT TO authenticated
  USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Owners/admins can manage providers"
  ON public.providers FOR ALL TO authenticated
  USING (
    organization_id = get_user_organization_id(auth.uid())
    AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'))
  )
  WITH CHECK (
    organization_id = get_user_organization_id(auth.uid())
    AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'))
  );

CREATE POLICY "Service role can manage providers"
  ON public.providers FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Provider schedules policies
CREATE POLICY "Block anonymous access to provider_schedules"
  ON public.provider_schedules FOR SELECT TO anon USING (false);

CREATE POLICY "Users can view schedules for their org providers"
  ON public.provider_schedules FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_schedules.provider_id
      AND p.organization_id = get_user_organization_id(auth.uid())
    )
  );

CREATE POLICY "Owners/admins can manage provider schedules"
  ON public.provider_schedules FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_schedules.provider_id
      AND p.organization_id = get_user_organization_id(auth.uid())
      AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_schedules.provider_id
      AND p.organization_id = get_user_organization_id(auth.uid())
      AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "Service role can manage provider schedules"
  ON public.provider_schedules FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Provider schedule overrides policies
CREATE POLICY "Block anonymous access to provider_schedule_overrides"
  ON public.provider_schedule_overrides FOR SELECT TO anon USING (false);

CREATE POLICY "Users can view overrides for their org providers"
  ON public.provider_schedule_overrides FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_schedule_overrides.provider_id
      AND p.organization_id = get_user_organization_id(auth.uid())
    )
  );

CREATE POLICY "Owners/admins can manage provider schedule overrides"
  ON public.provider_schedule_overrides FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_schedule_overrides.provider_id
      AND p.organization_id = get_user_organization_id(auth.uid())
      AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_schedule_overrides.provider_id
      AND p.organization_id = get_user_organization_id(auth.uid())
      AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "Service role can manage provider schedule overrides"
  ON public.provider_schedule_overrides FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Calendar events policies
CREATE POLICY "Block anonymous access to calendar_events"
  ON public.calendar_events FOR SELECT TO anon USING (false);

CREATE POLICY "Users can view calendar events in their organization"
  ON public.calendar_events FOR SELECT TO authenticated
  USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Owners/admins can manage calendar events"
  ON public.calendar_events FOR ALL TO authenticated
  USING (
    organization_id = get_user_organization_id(auth.uid())
    AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'))
  )
  WITH CHECK (
    organization_id = get_user_organization_id(auth.uid())
    AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'))
  );

CREATE POLICY "Service role can manage calendar events"
  ON public.calendar_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Calendar sync log policies
CREATE POLICY "Block anonymous access to calendar_sync_log"
  ON public.calendar_sync_log FOR SELECT TO anon USING (false);

CREATE POLICY "Users can view sync log for their organization"
  ON public.calendar_sync_log FOR SELECT TO authenticated
  USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Service role can manage calendar sync log"
  ON public.calendar_sync_log FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at for providers
CREATE TRIGGER update_providers_updated_at
  BEFORE UPDATE ON public.providers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Auto-update updated_at for calendar_events
CREATE TRIGGER update_calendar_events_updated_at
  BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
