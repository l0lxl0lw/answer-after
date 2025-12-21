-- Create storage bucket for greeting audio files
INSERT INTO storage.buckets (id, name, public)
VALUES ('greetings', 'greetings', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their org folder
CREATE POLICY "Organizations can upload greetings"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'greetings' 
  AND auth.role() = 'authenticated'
);

-- Allow public read access for Twilio to fetch audio
CREATE POLICY "Public read access for greetings"
ON storage.objects FOR SELECT
USING (bucket_id = 'greetings');

-- Allow authenticated users to update their org greetings
CREATE POLICY "Organizations can update greetings"
ON storage.objects FOR UPDATE
USING (bucket_id = 'greetings' AND auth.role() = 'authenticated');

-- Allow authenticated users to delete their org greetings
CREATE POLICY "Organizations can delete greetings"
ON storage.objects FOR DELETE
USING (bucket_id = 'greetings' AND auth.role() = 'authenticated');