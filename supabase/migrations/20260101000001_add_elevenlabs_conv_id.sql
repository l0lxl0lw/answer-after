-- Add elevenlabs_conversation_id to calls table
-- This allows us to look up recording/transcript from ElevenLabs when viewing call details

ALTER TABLE public.calls ADD COLUMN elevenlabs_conversation_id text;

-- Index for looking up calls by ElevenLabs conversation ID
CREATE INDEX idx_calls_elevenlabs_conv_id ON public.calls(elevenlabs_conversation_id);
