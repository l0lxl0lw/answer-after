-- Migration: Add leads tracking fields to calls table
-- This enables lead management for non-booked calls

-- Interest level enum (hot/warm/cold)
DO $$ BEGIN
  CREATE TYPE public.interest_level AS ENUM ('hot', 'warm', 'cold');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Lead status enum
DO $$ BEGIN
  CREATE TYPE public.lead_status AS ENUM ('new', 'contacted', 'converted', 'lost');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add columns to calls table
ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS interest_level interest_level DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS lead_status lead_status DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS lead_notes text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS lead_updated_at timestamp with time zone DEFAULT NULL;

-- Index for leads filtering (non-booked calls)
CREATE INDEX IF NOT EXISTS idx_calls_leads
  ON public.calls (organization_id, outcome, interest_level, lead_status)
  WHERE outcome IS NOT NULL AND outcome != 'booked';

-- Index for date-based queries
CREATE INDEX IF NOT EXISTS idx_calls_started_at
  ON public.calls (organization_id, started_at DESC);

COMMENT ON COLUMN public.calls.interest_level IS 'AI-detected or manually set interest level: hot, warm, cold';
COMMENT ON COLUMN public.calls.lead_status IS 'Lead lifecycle status: new, contacted, converted, lost';
COMMENT ON COLUMN public.calls.lead_notes IS 'Notes added by staff about this lead';
COMMENT ON COLUMN public.calls.lead_updated_at IS 'Timestamp of last lead field update';
