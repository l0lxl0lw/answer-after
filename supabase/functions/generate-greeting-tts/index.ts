import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient } from "../_shared/db.ts";
import { corsPreflightResponse, errorResponse, successResponse } from "../_shared/errors.ts";
import { createLogger } from "../_shared/logger.ts";
import { parseJsonBody } from "../_shared/validation.ts";

const logger = createLogger('generate-greeting-tts');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return corsPreflightResponse();
  }

  try {
    const log = logger.withContext({ requestId: crypto.randomUUID() });

    const body = await parseJsonBody<{
      greeting: string;
      institutionId: string;
    }>(req, ['greeting', 'institutionId']);

    const { greeting, institutionId } = body;

    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
    if (!ELEVENLABS_API_KEY) {
      throw new Error('ELEVENLABS_API_KEY not configured');
    }

    log.info('Generating TTS', { institutionId });

    // Generate TTS using ElevenLabs
    const voiceId = 'cjVigY5qzO86Huf0OWal'; // Eric voice
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: greeting,
          model_id: 'eleven_turbo_v2_5',
          output_format: 'mp3_44100_128',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            speed: 1.0,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      log.error('ElevenLabs TTS error', new Error(`${response.status}: ${errorText}`));
      throw new Error(`TTS generation failed: ${response.status}`);
    }

    const audioBuffer = await response.arrayBuffer();
    log.info('Audio generated', { bytes: audioBuffer.byteLength });

    // Upload to Supabase Storage
    const supabase = createServiceClient();
    const fileName = `${institutionId}/greeting.mp3`;

    // Delete existing file if any
    await supabase.storage.from('greetings').remove([fileName]);

    // Upload new file
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('greetings')
      .upload(fileName, audioBuffer, {
        contentType: 'audio/mpeg',
        upsert: true,
      });

    if (uploadError) {
      log.error('Storage upload error', uploadError);
      throw new Error(`Failed to upload audio: ${uploadError.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('greetings')
      .getPublicUrl(fileName);

    log.info('Greeting audio saved', { url: urlData.publicUrl });

    return successResponse({
      success: true,
      audioUrl: urlData.publicUrl,
      audioSize: audioBuffer.byteLength
    });

  } catch (error) {
    logger.error('Handler error', error as Error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(message, 500);
  }
});
