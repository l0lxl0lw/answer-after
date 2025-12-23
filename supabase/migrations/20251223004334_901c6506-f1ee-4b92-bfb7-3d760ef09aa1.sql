-- Drop the foreign key constraint first
ALTER TABLE public.organization_agents DROP CONSTRAINT IF EXISTS organization_agents_voice_id_fkey;

-- Drop the voice_id column from organization_agents
ALTER TABLE public.organization_agents DROP COLUMN IF EXISTS voice_id;

-- Drop the elevenlabs_voices table
DROP TABLE IF EXISTS public.elevenlabs_voices;