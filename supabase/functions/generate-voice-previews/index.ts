import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient } from "../_shared/db.ts";
import { corsPreflightResponse, errorResponse, successResponse } from "../_shared/errors.ts";
import { createLogger } from "../_shared/logger.ts";
import { getElevenLabsApiKey, generateVoicePreview } from "../_shared/elevenlabs.ts";

const logger = createLogger('generate-voice-previews');

const PREVIEW_TEXT = "Hello, Thanks for calling. How can I help you today?";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return corsPreflightResponse();
  }

  try {
    const log = logger.withContext({ requestId: crypto.randomUUID() });

    const elevenlabsApiKey = getElevenLabsApiKey();
    const supabase = createServiceClient();

    // Get all voices that don't have a preview_url yet
    const { data: voices, error: fetchError } = await supabase
      .from('elevenlabs_voices')
      .select('*')
      .is('preview_url', null);

    if (fetchError) throw fetchError;

    log.info(`Found ${voices?.length || 0} voices without previews`);

    const results = [];

    for (const voice of voices || []) {
      try {
        log.step(`Generating preview for ${voice.name}`);

        // Generate TTS using shared utility
        const audioBuffer = await generateVoicePreview(
          PREVIEW_TEXT,
          voice.elevenlabs_voice_id,
          elevenlabsApiKey
        );

        const fileName = `voice-previews/${voice.elevenlabs_voice_id}.mp3`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('tts-audio')
          .upload(fileName, audioBuffer, {
            contentType: 'audio/mpeg',
            upsert: true,
          });

        if (uploadError) {
          log.warn(`Upload failed for ${voice.name}`, { error: uploadError.message });
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
          log.warn(`Update failed for ${voice.name}`, { error: updateError.message });
          continue;
        }

        results.push({ voice: voice.name, status: 'success', url: urlData.publicUrl });
        log.info(`Successfully generated preview for ${voice.name}`);

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (voiceError) {
        log.warn(`Error processing ${voice.name}`, { error: (voiceError as Error).message });
        results.push({ voice: voice.name, status: 'error', error: String(voiceError) });
      }
    }

    return successResponse({ success: true, results });

  } catch (error) {
    logger.error('Handler error', error as Error);
    return errorResponse(error as Error);
  }
});
