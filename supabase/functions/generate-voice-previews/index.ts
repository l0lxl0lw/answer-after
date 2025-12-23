import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PREVIEW_TEXT = "Hello, Thanks for calling. How can I help you today?";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
    if (!ELEVENLABS_API_KEY) {
      throw new Error('ELEVENLABS_API_KEY is not set');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all voices that don't have a preview_url yet
    const { data: voices, error: fetchError } = await supabase
      .from('elevenlabs_voices')
      .select('*')
      .is('preview_url', null);

    if (fetchError) throw fetchError;

    console.log(`Found ${voices?.length || 0} voices without previews`);

    const results = [];

    for (const voice of voices || []) {
      try {
        console.log(`Generating preview for ${voice.name} (${voice.elevenlabs_voice_id})`);

        // Generate TTS
        const ttsResponse = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${voice.elevenlabs_voice_id}`,
          {
            method: 'POST',
            headers: {
              'xi-api-key': ELEVENLABS_API_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              text: PREVIEW_TEXT,
              model_id: 'eleven_multilingual_v2',
              output_format: 'mp3_44100_128',
            }),
          }
        );

        if (!ttsResponse.ok) {
          const error = await ttsResponse.text();
          console.error(`TTS failed for ${voice.name}:`, error);
          continue;
        }

        const audioBuffer = await ttsResponse.arrayBuffer();
        const fileName = `voice-previews/${voice.elevenlabs_voice_id}.mp3`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('tts-audio')
          .upload(fileName, audioBuffer, {
            contentType: 'audio/mpeg',
            upsert: true,
          });

        if (uploadError) {
          console.error(`Upload failed for ${voice.name}:`, uploadError);
          continue;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('tts-audio')
          .getPublicUrl(fileName);

        // Update the voice record with the preview URL
        const { error: updateError } = await supabase
          .from('elevenlabs_voices')
          .update({ preview_url: urlData.publicUrl })
          .eq('id', voice.id);

        if (updateError) {
          console.error(`Update failed for ${voice.name}:`, updateError);
          continue;
        }

        results.push({ voice: voice.name, status: 'success', url: urlData.publicUrl });
        console.log(`Successfully generated preview for ${voice.name}`);

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (voiceError) {
        console.error(`Error processing ${voice.name}:`, voiceError);
        results.push({ voice: voice.name, status: 'error', error: String(voiceError) });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
