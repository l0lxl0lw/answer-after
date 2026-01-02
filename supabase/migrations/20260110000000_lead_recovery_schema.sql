-- Lead Recovery Schema Migration
-- Transforms AnswerAfter from dental appointment booking to home services lead recovery

-- ============================================
-- ENUM TYPES
-- ============================================

CREATE TYPE public.intake_urgency AS ENUM ('low', 'normal', 'high', 'emergency');
CREATE TYPE public.intake_category AS ENUM (
  'hvac',
  'plumbing',
  'electrical',
  'roofing',
  'appliance',
  'locksmith',
  'pest_control',
  'general'
);
CREATE TYPE public.escalation_role AS ENUM ('owner', 'manager', 'technician', 'on_call');

-- ============================================
-- ESCALATION CONTACTS TABLE
-- On-call rotation for emergency transfers
-- ============================================

CREATE TABLE public.escalation_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  role escalation_role DEFAULT 'on_call',
  priority INTEGER NOT NULL DEFAULT 1,  -- Lower = higher priority (1 = first to call)
  is_active BOOLEAN NOT NULL DEFAULT true,
  -- Optional: per-contact coverage schedule
  coverage_schedule JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(institution_id, phone)
);

COMMENT ON TABLE public.escalation_contacts IS 'On-call contacts for emergency call transfers';
COMMENT ON COLUMN public.escalation_contacts.priority IS 'Lower number = higher priority. 1 is first to be called.';
COMMENT ON COLUMN public.escalation_contacts.coverage_schedule IS 'Optional override schedule for when this contact is on-call';

-- ============================================
-- CALL INTAKES TABLE
-- Structured lead data from AI agent intake
-- ============================================

CREATE TABLE public.call_intakes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  call_id UUID REFERENCES public.calls(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,

  -- Caller information
  caller_name TEXT,
  caller_phone TEXT NOT NULL,
  caller_address TEXT,
  caller_zip TEXT,

  -- Issue details
  service_category intake_category,
  issue_description TEXT,
  urgency intake_urgency NOT NULL DEFAULT 'normal',

  -- Emergency detection
  is_emergency BOOLEAN NOT NULL DEFAULT false,
  emergency_keywords TEXT[],  -- Keywords that triggered emergency detection

  -- Transfer tracking
  was_transferred BOOLEAN NOT NULL DEFAULT false,
  transferred_to_phone TEXT,
  transferred_to_name TEXT,
  transfer_accepted BOOLEAN,  -- Did the escalation contact answer?

  -- Callback tracking
  callback_requested BOOLEAN NOT NULL DEFAULT false,
  callback_scheduled_for TIMESTAMPTZ,
  callback_completed_at TIMESTAMPTZ,
  callback_notes TEXT,

  -- AI metadata
  extraction_confidence NUMERIC(3,2),  -- 0.00-1.00 score from LLM
  raw_transcript TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.call_intakes IS 'Structured intake data collected by AI agent during calls';
COMMENT ON COLUMN public.call_intakes.emergency_keywords IS 'Keywords matched during emergency detection';
COMMENT ON COLUMN public.call_intakes.extraction_confidence IS 'AI confidence score for extracted data (0.00-1.00)';

-- ============================================
-- INSTITUTIONS TABLE MODIFICATIONS
-- Add workflow configuration
-- ============================================

ALTER TABLE public.institutions ADD COLUMN IF NOT EXISTS workflow_config JSONB DEFAULT '{
  "emergency_keywords": ["no heat", "gas smell", "gas leak", "flood", "flooding", "fire", "smoke", "carbon monoxide", "no power", "sparking", "electrical fire", "water damage", "burst pipe", "sewage", "no ac", "no air conditioning"],
  "service_categories": ["hvac", "plumbing", "electrical", "general"],
  "transfer_enabled": true,
  "callback_hours_offset": 2
}'::jsonb;

COMMENT ON COLUMN public.institutions.workflow_config IS 'Lead recovery workflow configuration';

-- ============================================
-- INSTITUTION_AGENTS TABLE MODIFICATIONS
-- Add workflow ID tracking
-- ============================================

ALTER TABLE public.institution_agents ADD COLUMN IF NOT EXISTS elevenlabs_workflow_id TEXT;

COMMENT ON COLUMN public.institution_agents.elevenlabs_workflow_id IS 'ElevenLabs workflow ID for this agent';

-- ============================================
-- CALLS TABLE MODIFICATIONS
-- Add intake and transfer tracking
-- ============================================

ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS intake_id UUID REFERENCES public.call_intakes(id) ON DELETE SET NULL;
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS was_transferred BOOLEAN DEFAULT false;
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS transferred_to_phone TEXT;
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS transferred_to_contact_id UUID REFERENCES public.escalation_contacts(id) ON DELETE SET NULL;
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS trigger_type TEXT CHECK (trigger_type IN ('coverage', 'overflow', 'direct'));

COMMENT ON COLUMN public.calls.intake_id IS 'Link to structured intake data collected during call';
COMMENT ON COLUMN public.calls.trigger_type IS 'How the call was routed: coverage (after hours), overflow (no answer), direct';

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_escalation_contacts_institution
  ON public.escalation_contacts(institution_id);

CREATE INDEX IF NOT EXISTS idx_escalation_contacts_active_priority
  ON public.escalation_contacts(institution_id, priority)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_call_intakes_institution
  ON public.call_intakes(institution_id);

CREATE INDEX IF NOT EXISTS idx_call_intakes_created
  ON public.call_intakes(institution_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_call_intakes_urgency
  ON public.call_intakes(institution_id, urgency)
  WHERE urgency IN ('high', 'emergency');

CREATE INDEX IF NOT EXISTS idx_call_intakes_callback_pending
  ON public.call_intakes(institution_id, callback_scheduled_for)
  WHERE callback_requested = true AND callback_completed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_calls_intake
  ON public.calls(intake_id)
  WHERE intake_id IS NOT NULL;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.escalation_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_intakes ENABLE ROW LEVEL SECURITY;

-- Escalation contacts policies
CREATE POLICY "Users can view escalation contacts in their institution"
  ON public.escalation_contacts FOR SELECT TO authenticated
  USING (institution_id = get_user_institution_id(auth.uid()));

CREATE POLICY "Owners and admins can manage escalation contacts"
  ON public.escalation_contacts FOR ALL TO authenticated
  USING (
    institution_id = get_user_institution_id(auth.uid())
    AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'))
  )
  WITH CHECK (
    institution_id = get_user_institution_id(auth.uid())
    AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'))
  );

CREATE POLICY "Service role full access to escalation contacts"
  ON public.escalation_contacts FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Call intakes policies
CREATE POLICY "Users can view call intakes in their institution"
  ON public.call_intakes FOR SELECT TO authenticated
  USING (institution_id = get_user_institution_id(auth.uid()));

CREATE POLICY "Service role full access to call intakes"
  ON public.call_intakes FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================
-- UPDATED_AT TRIGGERS
-- ============================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_escalation_contacts_updated_at
  BEFORE UPDATE ON public.escalation_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_call_intakes_updated_at
  BEFORE UPDATE ON public.call_intakes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
