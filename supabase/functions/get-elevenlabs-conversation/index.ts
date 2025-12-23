import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ElevenLabsTranscript {
  role: string;
  message: string;
  time_in_call_secs: number;
}

interface ElevenLabsConversationDetail {
  conversation_id: string;
  agent_id: string;
  status: string;
  transcript: ElevenLabsTranscript[];
  metadata: {
    start_time_unix_secs: number;
    call_duration_secs: number;
  };
  analysis?: {
    transcript_summary?: string;
    call_successful?: string;
    data_collection_results?: Record<string, { value: string; json_schema: any }>;
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

    // Get conversation ID from URL
    const url = new URL(req.url);
    const conversationId = url.searchParams.get("conversation_id");
    
    if (!conversationId) {
      return new Response(JSON.stringify({ error: "conversation_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Fetching conversation details for:", conversationId);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const elevenlabsApiKey = Deno.env.get("ELEVENLABS_API_KEY");
    if (!elevenlabsApiKey) {
      return new Response(JSON.stringify({ error: "ElevenLabs API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch conversation details from ElevenLabs
    const apiUrl = `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`;
    
    const response = await fetch(apiUrl, {
      headers: {
        "xi-api-key": elevenlabsApiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs API error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Conversation not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data: ElevenLabsConversationDetail = await response.json();
    console.log("Conversation data fetched successfully");

    // Extract client data from data collection results
    let callerName: string | null = null;
    let callerPhone: string | null = null;
    
    if (data.analysis?.data_collection_results) {
      const results = data.analysis.data_collection_results;
      if (results.caller_name) callerName = results.caller_name.value;
      if (results.customer_name) callerName = results.customer_name.value;
      if (results.name) callerName = results.name.value;
      if (results.caller_phone) callerPhone = results.caller_phone.value;
      if (results.phone) callerPhone = results.phone.value;
    }

    // Transform to our format
    const transformedData = {
      id: data.conversation_id,
      conversation_id: data.conversation_id,
      caller_phone: callerPhone || "Unknown",
      caller_name: callerName,
      status: data.status === "done" ? "completed" : data.status,
      outcome: data.analysis?.call_successful === "success" ? "information_provided" : 
               data.analysis?.call_successful === "failure" ? "no_action" : null,
      is_emergency: false,
      started_at: new Date(data.metadata.start_time_unix_secs * 1000).toISOString(),
      ended_at: new Date((data.metadata.start_time_unix_secs + data.metadata.call_duration_secs) * 1000).toISOString(),
      duration_seconds: data.metadata.call_duration_secs,
      summary: data.analysis?.transcript_summary || null,
      twilio_call_sid: null,
      recording_url: null,
      phone_number: null,
      events: [
        {
          id: `${data.conversation_id}-initiated`,
          event_type: "initiated",
          created_at: new Date(data.metadata.start_time_unix_secs * 1000).toISOString(),
          ai_response: "Call connected to AI assistant",
          ai_prompt: null,
          event_data: null,
        },
        ...(data.status === "done" ? [{
          id: `${data.conversation_id}-completed`,
          event_type: "completed",
          created_at: new Date((data.metadata.start_time_unix_secs + data.metadata.call_duration_secs) * 1000).toISOString(),
          ai_response: data.analysis?.call_successful === "success" ? "Call completed successfully" : "Call ended",
          ai_prompt: null,
          event_data: null,
        }] : []),
      ],
      transcripts: (data.transcript || []).map((t, index) => ({
        id: `${data.conversation_id}-${index}`,
        speaker: t.role === "agent" ? "ai" : "user",
        content: t.message,
        timestamp_ms: Math.round(t.time_in_call_secs * 1000),
        confidence: 1,
      })),
    };

    return new Response(JSON.stringify(transformedData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching conversation details:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
