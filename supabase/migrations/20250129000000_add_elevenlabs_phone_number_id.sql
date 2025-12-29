-- Add elevenlabs_phone_number_id to phone_numbers table
ALTER TABLE public.phone_numbers
ADD COLUMN IF NOT EXISTS elevenlabs_phone_number_id text;

-- Add comment for documentation
COMMENT ON COLUMN public.phone_numbers.elevenlabs_phone_number_id IS 'The phone number ID returned by ElevenLabs when importing the number';
