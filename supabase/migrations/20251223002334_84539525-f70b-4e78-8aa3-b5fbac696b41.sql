-- Add preview_url column to elevenlabs_voices
ALTER TABLE public.elevenlabs_voices
ADD COLUMN preview_url TEXT;