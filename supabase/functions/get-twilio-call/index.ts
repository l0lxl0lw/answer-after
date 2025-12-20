import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

interface ElevenLabsConversation {
  agent_id: string;
  conversation_id: string;
  status: string;
  transcript: Array<{
    role: string;
    message: string;
    time_in_call_secs: number;
  }>;
  metadata: {
    start_time_unix_secs: number;
    call_duration_secs: number;
  };
  analysis?: {
    transcript_summary?: string;
    call_successful?: string;
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get call SID from URL
    const url = new URL(req.url);
    const callSid = url.searchParams.get("call_sid");
    
    if (!callSid) {
      return new Response(JSON.stringify({ error: "call_sid is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Fetching call details for SID:", callSid);

    // Get Twilio credentials
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const elevenlabsApiKey = Deno.env.get("ELEVENLABS_API_KEY");

    if (!accountSid || !authToken) {
      return new Response(JSON.stringify({ error: "Twilio credentials not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch call details from Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls/${callSid}.json`;
    console.log("Fetching from Twilio:", twilioUrl);

    const twilioResponse = await fetch(twilioUrl, {
      headers: {
        Authorization: "Basic " + btoa(`${accountSid}:${authToken}`),
      },
    });

    if (!twilioResponse.ok) {
      const errorText = await twilioResponse.text();
      console.error("Twilio API error:", twilioResponse.status, errorText);
      return new Response(JSON.stringify({ error: "Call not found in Twilio" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const twilioCall: TwilioCall = await twilioResponse.json();
    console.log("Twilio call data:", JSON.stringify(twilioCall));

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
        // First, list conversations to find one matching this call's timeframe
        console.log("Fetching ElevenLabs conversations...");
        
        // Get conversations from ElevenLabs
        const conversationsUrl = "https://api.elevenlabs.io/v1/convai/conversations";
        const conversationsResponse = await fetch(conversationsUrl, {
          headers: {
            "xi-api-key": elevenlabsApiKey,
          },
        });

        if (conversationsResponse.ok) {
          const conversationsData = await conversationsResponse.json();
          console.log(`Found ${conversationsData.conversations?.length || 0} ElevenLabs conversations`);

          // Find conversation that matches the call time (within a 5-minute window)
          const callStartTime = new Date(twilioCall.start_time || twilioCall.date_created).getTime() / 1000;
          
          let matchedConversation = null;
          for (const conv of conversationsData.conversations || []) {
            // Check if conversation started around the same time as the call
            const convStartTime = conv.start_time_unix_secs || conv.metadata?.start_time_unix_secs;
            if (convStartTime && Math.abs(convStartTime - callStartTime) < 300) {
              matchedConversation = conv;
              break;
            }
          }

          if (matchedConversation) {
            console.log("Found matching ElevenLabs conversation:", matchedConversation.conversation_id);

            // Fetch full conversation details
            const convDetailUrl = `https://api.elevenlabs.io/v1/convai/conversations/${matchedConversation.conversation_id}`;
            const convDetailResponse = await fetch(convDetailUrl, {
              headers: {
                "xi-api-key": elevenlabsApiKey,
              },
            });

            if (convDetailResponse.ok) {
              const convDetail: ElevenLabsConversation = await convDetailResponse.json();
              console.log("ElevenLabs conversation detail fetched successfully");

              // Extract transcript
              if (convDetail.transcript && convDetail.transcript.length > 0) {
                callData.transcripts = convDetail.transcript.map((t, index) => ({
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
            }
          } else {
            console.log("No matching ElevenLabs conversation found for this call time");
          }
        } else {
          console.log("Failed to fetch ElevenLabs conversations:", conversationsResponse.status);
        }
      } catch (elevenlabsError) {
        console.error("Error fetching ElevenLabs data:", elevenlabsError);
        // Continue without ElevenLabs data
      }
    }

    // Try to fetch Twilio recording
    try {
      const recordingsUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings.json?CallSid=${callSid}`;
      const recordingsResponse = await fetch(recordingsUrl, {
        headers: {
          Authorization: "Basic " + btoa(`${accountSid}:${authToken}`),
        },
      });

      if (recordingsResponse.ok) {
        const recordingsData = await recordingsResponse.json();
        if (recordingsData.recordings && recordingsData.recordings.length > 0) {
          const recording = recordingsData.recordings[0];
          callData.recording_url = `https://api.twilio.com${recording.uri.replace('.json', '.mp3')}`;
        }
      }
    } catch (recordingError) {
      console.error("Error fetching recording:", recordingError);
    }

    console.log("Returning call data with", callData.transcripts.length, "transcripts");

    return new Response(JSON.stringify(callData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching call details:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
