-- Add a column to store per-day business hours as JSONB
-- Structure: { "monday": { "enabled": true, "start": "08:00", "end": "17:00" }, ... }
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS business_hours_schedule jsonb DEFAULT '{
  "monday": { "enabled": true, "start": "09:00", "end": "17:00" },
  "tuesday": { "enabled": true, "start": "09:00", "end": "17:00" },
  "wednesday": { "enabled": true, "start": "09:00", "end": "17:00" },
  "thursday": { "enabled": true, "start": "09:00", "end": "17:00" },
  "friday": { "enabled": true, "start": "09:00", "end": "17:00" },
  "saturday": { "enabled": false, "start": "09:00", "end": "17:00" },
  "sunday": { "enabled": false, "start": "09:00", "end": "17:00" }
}'::jsonb;