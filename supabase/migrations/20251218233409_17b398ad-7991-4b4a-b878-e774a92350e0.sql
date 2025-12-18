-- Create storage bucket for TTS audio files
INSERT INTO storage.buckets (id, name, public) VALUES ('tts-audio', 'tts-audio', true);

-- Create policy for public read access
CREATE POLICY "TTS audio is publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'tts-audio');

-- Create policy for service role to upload
CREATE POLICY "Service role can upload TTS audio"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'tts-audio');