-- ============================================
-- NexHealth Integration
-- ============================================
-- Adds NexHealth Synchronizer API configuration for dental PMS connectivity
-- Supports Dentrix, Eaglesoft, OpenDental integration via NexHealth

-- ============================================
-- ADD NEXHEALTH CONFIG TO ORGANIZATIONS
-- ============================================

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS nexhealth_subdomain TEXT,
  ADD COLUMN IF NOT EXISTS nexhealth_location_id TEXT,
  ADD COLUMN IF NOT EXISTS nexhealth_enabled BOOLEAN NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.organizations.nexhealth_subdomain IS 'NexHealth Synchronizer subdomain for this practice';
COMMENT ON COLUMN public.organizations.nexhealth_location_id IS 'NexHealth location ID for this practice';
COMMENT ON COLUMN public.organizations.nexhealth_enabled IS 'Whether NexHealth integration is active for this organization';

-- ============================================
-- ADD NEXHEALTH PATIENT ID TO CONTACTS
-- ============================================
-- Cache NexHealth patient ID for faster lookups

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS nexhealth_patient_id TEXT;

COMMENT ON COLUMN public.contacts.nexhealth_patient_id IS 'NexHealth patient ID for linking local contacts to PMS records';

-- Index for faster patient ID lookups
CREATE INDEX IF NOT EXISTS idx_contacts_nexhealth_patient_id
  ON public.contacts(nexhealth_patient_id)
  WHERE nexhealth_patient_id IS NOT NULL;

-- ============================================
-- ADD NEXHEALTH REFERENCES TO APPOINTMENTS
-- ============================================
-- Track appointments created via NexHealth

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS nexhealth_appointment_id TEXT,
  ADD COLUMN IF NOT EXISTS nexhealth_patient_id TEXT,
  ADD COLUMN IF NOT EXISTS nexhealth_operatory_id TEXT;

COMMENT ON COLUMN public.appointments.nexhealth_appointment_id IS 'NexHealth appointment ID for sync tracking';
COMMENT ON COLUMN public.appointments.nexhealth_patient_id IS 'NexHealth patient ID associated with this appointment';
COMMENT ON COLUMN public.appointments.nexhealth_operatory_id IS 'NexHealth operatory ID where appointment takes place';

-- Index for NexHealth appointment lookup
CREATE INDEX IF NOT EXISTS idx_appointments_nexhealth_id
  ON public.appointments(nexhealth_appointment_id)
  WHERE nexhealth_appointment_id IS NOT NULL;

-- ============================================
-- ADD NEXHEALTH TO CALENDAR EVENTS SOURCE
-- ============================================
-- Update check constraint to include nexhealth as valid source
-- Note: The constraint already includes 'nexhealth' from the native_calendar migration

-- Verify the source constraint includes nexhealth
DO $$
BEGIN
  -- Check if nexhealth is in the constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'calendar_events_source_check'
    AND conrelid = 'public.calendar_events'::regclass
  ) THEN
    -- Add constraint if it doesn't exist
    ALTER TABLE public.calendar_events
      ADD CONSTRAINT calendar_events_source_check
      CHECK (source IN ('native', 'google', 'nexhealth', 'other_pms'));
  END IF;
END $$;
