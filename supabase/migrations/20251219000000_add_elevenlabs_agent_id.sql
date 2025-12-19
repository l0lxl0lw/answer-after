-- Add ElevenLabs agent ID to organizations table
ALTER TABLE organizations 
ADD COLUMN elevenlabs_agent_id TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_organizations_elevenlabs_agent_id 
ON organizations(elevenlabs_agent_id);