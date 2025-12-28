-- Create table for available ElevenLabs voices
CREATE TABLE public.elevenlabs_voices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  elevenlabs_voice_id TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.elevenlabs_voices ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read active voices
CREATE POLICY "Authenticated users can view active voices"
ON public.elevenlabs_voices
FOR SELECT
TO authenticated
USING (is_active = true);

-- Add voice_id column to organization_agents
ALTER TABLE public.organization_agents
ADD COLUMN voice_id UUID REFERENCES public.elevenlabs_voices(id);

-- Insert the available voices
INSERT INTO public.elevenlabs_voices (name, elevenlabs_voice_id, description) VALUES
('Burt', 'IKne3meq5aSn9XLyUdCD', 'Deep, professional male voice'),
('River', 'SAz9YHcvj6GT2YYXdXww', 'Calm, natural voice'),
('Liam', 'TX3LPaxmHKxFdv7VOQHJ', 'Friendly male voice'),
('Matilda', 'XrExE9yKIg1WjnnlVkGX', 'Warm, professional female voice');

-- Add trigger for updated_at
CREATE TRIGGER update_elevenlabs_voices_updated_at
BEFORE UPDATE ON public.elevenlabs_voices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();