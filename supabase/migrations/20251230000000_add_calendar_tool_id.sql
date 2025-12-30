-- Add elevenlabs_calendar_tool_id column to organization_agents table
-- This stores the ElevenLabs tool ID for the calendar availability tool
ALTER TABLE public.organization_agents
ADD COLUMN IF NOT EXISTS elevenlabs_calendar_tool_id text;

COMMENT ON COLUMN public.organization_agents.elevenlabs_calendar_tool_id IS 'ElevenLabs tool ID for calendar availability checking';
