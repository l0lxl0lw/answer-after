-- Migration: Remove Google Calendar Integration
-- Removes all Google-related tables and columns

-- Drop Google Calendar connections table and its policies
DROP TABLE IF EXISTS public.google_calendar_connections CASCADE;

-- Remove google_calendar_id from providers table
ALTER TABLE public.providers DROP COLUMN IF EXISTS google_calendar_id;

-- Note: We keep 'google' as a valid source in calendar_events for any historical data
-- but no new Google events will be created after this migration
