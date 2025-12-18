-- Create storage bucket for TTS audio files
INSERT INTO storage.buckets (id, name, public)
VALUES ('tts-audio', 'tts-audio', true);

-- Allow public read access to TTS audio files
CREATE POLICY "Public read access for TTS audio"
ON storage.objects FOR SELECT
USING (bucket_id = 'tts-audio');

-- Allow service role to insert/delete TTS audio
CREATE POLICY "Service role can manage TTS audio"
ON storage.objects FOR ALL
USING (bucket_id = 'tts-audio')
WITH CHECK (bucket_id = 'tts-audio');