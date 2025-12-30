import { corsPreflightResponse, errorResponse, successResponse } from "../_shared/errors.ts";
import { createLogger } from "../_shared/logger.ts";
import { getTwilioCredentials, makeTwilioRequest, getAccountUrl, getTwilioAuthHeader } from "../_shared/twilio.ts";
import { getElevenLabsApiKey, getConversations, getConversation } from "../_shared/elevenlabs.ts";

const logger = createLogger('get-twilio-call');

interface TwilioCall {
  sid: string;
  from: string;
  to: string;
  status: string;
  direction: string;
  duration: string;
  start_time: string;
  end_time: string;
  date_created: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return corsPreflightResponse();
  }

  try {
    const log = logger.withContext({ requestId: crypto.randomUUID() });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errorResponse("No authorization header", 401);
    }

    // Get call SID from URL
    const url = new URL(req.url);
    const callSid = url.searchParams.get("call_sid");

    if (!callSid) {
      return errorResponse("call_sid is required", 400);
    }

    log.info("Fetching call details", { callSid });

    const twilioCredentials = getTwilioCredentials();
    let elevenlabsApiKey: string | null = null;

    try {
      elevenlabsApiKey = getElevenLabsApiKey();
    } catch {
      log.warn("ElevenLabs API key not configured");
    }

    // Fetch call details from Twilio
    const twilioCall = await makeTwilioRequest<TwilioCall>(
      `${getAccountUrl(twilioCredentials.accountSid)}/Calls/${callSid}.json`,
      twilioCredentials
    );

    log.info("Twilio call data fetched", { status: twilioCall.status });

    // Map Twilio status to our status
    let status = "completed";
    let outcome: string | null = null;

    switch (twilioCall.status) {
      case "completed":
        status = "completed";
        outcome = parseInt(twilioCall.duration) > 0 ? "information_provided" : "no_action";
        break;
      case "busy":
      case "no-answer":
      case "canceled":
        status = "failed";
        outcome = "no_action";
        break;
      case "failed":
        status = "failed";
        outcome = "no_action";
        break;
      case "in-progress":
      case "ringing":
      case "queued":
        status = "active";
        break;
    }

    // Build base call response
    const callData = {
      id: twilioCall.sid,
      caller_phone: twilioCall.from,
      caller_name: null as string | null,
      status,
      outcome,
      is_emergency: false,
      started_at: twilioCall.start_time || twilioCall.date_created,
      ended_at: twilioCall.end_time || null,
      duration_seconds: parseInt(twilioCall.duration) || 0,
      summary: null as string | null,
      twilio_call_sid: twilioCall.sid,
      recording_url: null as string | null,
      phone_number: {
        friendly_name: twilioCall.to,
        phone_number: twilioCall.to,
      },
      events: [] as any[],
      transcripts: [] as any[],
    };

    // Try to fetch ElevenLabs conversation history
    if (elevenlabsApiKey) {
      try {
        log.step("Fetching ElevenLabs conversations");

        const conversations = await getConversations("", elevenlabsApiKey);
        log.info(`Found ${conversations.length} ElevenLabs conversations`);

        // Find conversation that matches the call time (within a 5-minute window)
        const callStartTime = new Date(twilioCall.start_time || twilioCall.date_created).getTime() / 1000;

        let matchedConversation = null;
        for (const conv of conversations) {
          const convStartTime = conv.start_time_unix_secs || conv.metadata?.start_time_unix_secs;
          if (convStartTime && Math.abs(convStartTime - callStartTime) < 300) {
            matchedConversation = conv;
            break;
          }
        }

        if (matchedConversation) {
          log.info("Found matching ElevenLabs conversation", { conversationId: matchedConversation.conversation_id });

          const convDetail = await getConversation(matchedConversation.conversation_id, elevenlabsApiKey);

          // Extract transcript
          if (convDetail.transcript && convDetail.transcript.length > 0) {
            callData.transcripts = convDetail.transcript.map((t: any, index: number) => ({
              id: `${matchedConversation.conversation_id}-${index}`,
              speaker: t.role === "agent" ? "ai" : "user",
              content: t.message,
              timestamp_ms: (t.time_in_call_secs || 0) * 1000,
              confidence: 1,
            }));
          }

          // Extract summary from analysis
          if (convDetail.analysis?.transcript_summary) {
            callData.summary = convDetail.analysis.transcript_summary;
          }

          // Add events from conversation
          callData.events.push({
            id: `${matchedConversation.conversation_id}-initiated`,
            event_type: "initiated",
            created_at: callData.started_at,
            ai_response: "Call connected to AI assistant",
          });

          if (convDetail.analysis?.call_successful === "success") {
            callData.events.push({
              id: `${matchedConversation.conversation_id}-completed`,
              event_type: "completed",
              created_at: callData.ended_at || callData.started_at,
              ai_response: "Call completed successfully",
            });
          }
        } else {
          log.info("No matching ElevenLabs conversation found for this call time");
        }
      } catch (elevenlabsError) {
        log.warn("Error fetching ElevenLabs data", { error: (elevenlabsError as Error).message });
      }
    }

    // Try to fetch Twilio recording
    try {
      const recordingsData = await makeTwilioRequest<{
        recordings: Array<{ uri: string }>;
      }>(
        `${getAccountUrl(twilioCredentials.accountSid)}/Recordings.json?CallSid=${callSid}`,
        twilioCredentials
      );

      if (recordingsData.recordings && recordingsData.recordings.length > 0) {
        const recording = recordingsData.recordings[0];
        callData.recording_url = `https://api.twilio.com${recording.uri.replace('.json', '.mp3')}`;
      }
    } catch (recordingError) {
      log.warn("Error fetching recording", { error: (recordingError as Error).message });
    }

    log.info("Returning call data", { transcriptCount: callData.transcripts.length });

    return successResponse(callData);

  } catch (error) {
    logger.error("Handler error", error as Error);
    return errorResponse(error as Error);
  }
});
