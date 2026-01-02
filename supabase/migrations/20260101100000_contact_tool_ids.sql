-- Add columns to store ElevenLabs contact tool IDs
-- Each organization gets its own tools with org_id baked in for security isolation

ALTER TABLE organization_agents
ADD COLUMN IF NOT EXISTS elevenlabs_save_contact_tool_id text,
ADD COLUMN IF NOT EXISTS elevenlabs_lookup_contact_tool_id text;

COMMENT ON COLUMN organization_agents.elevenlabs_save_contact_tool_id IS 'ElevenLabs tool ID for saving contacts during live calls';
COMMENT ON COLUMN organization_agents.elevenlabs_lookup_contact_tool_id IS 'ElevenLabs tool ID for looking up contacts during live calls';
