import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const SOURCE_TAG = "AnswerAfter";

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

// Helper to get valid access token
async function getValidAccessToken(supabase: any, organizationId: string): Promise<string | null> {
  const { data: connection, error } = await supabase
    .from("google_calendar_connections")
    .select("*")
    .eq("organization_id", organizationId)
    .single();

  if (error || !connection) return null;

  const expiresAt = new Date(connection.token_expires_at);
  const now = new Date();
  
  if (now >= expiresAt) {
    const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: connection.refresh_token,
        grant_type: "refresh_token",
      }),
    });

    const refreshData = await refreshResponse.json();
    if (refreshData.error) return null;

    const newExpiresAt = new Date(Date.now() + refreshData.expires_in * 1000).toISOString();
    await supabase
      .from("google_calendar_connections")
      .update({
        access_token: refreshData.access_token,
        token_expires_at: newExpiresAt,
      })
      .eq("organization_id", organizationId);

    return refreshData.access_token;
  }

  return connection.access_token;
}

// Helper to create contact in Google
async function createGoogleContact(accessToken: string, name: string, phone: string, notes?: string): Promise<boolean> {
  try {
    const contactData = {
      names: [{ givenName: name }],
      phoneNumbers: [{ value: phone, type: "mobile" }],
      biographies: [{
        value: `Source: ${SOURCE_TAG}${notes ? `\n${notes}` : ""}`,
        contentType: "TEXT_PLAIN"
      }],
    };

    const response = await fetch(
      "https://people.googleapis.com/v1/people:createContact?personFields=names,phoneNumbers,biographies",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(contactData),
      }
    );

    if (!response.ok) {
      console.error("Failed to create contact:", await response.text());
      return false;
    }

    console.log("Contact created successfully for:", name);
    return true;
  } catch (error) {
    console.error("Error creating contact:", error);
    return false;
  }
}

// Check if contact already exists
async function contactExists(accessToken: string, phone: string): Promise<boolean> {
  try {
    const searchUrl = `https://people.googleapis.com/v1/people:searchContacts?query=${encodeURIComponent(phone)}&readMask=phoneNumbers&sources=READ_SOURCE_TYPE_CONTACT&pageSize=10`;
    const response = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) return false;

    const data = await response.json();
    return (data.results?.length || 0) > 0;
  } catch {
    return false;
  }
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
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user's organization
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();
    
    const organizationId = profile?.organization_id;

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

    // Auto-create Google Contact if we have name and phone and org is connected
    if (callerName && callerPhone && organizationId) {
      try {
        const accessToken = await getValidAccessToken(supabaseAdmin, organizationId);
        if (accessToken) {
          const exists = await contactExists(accessToken, callerPhone);
          if (!exists) {
            await createGoogleContact(accessToken, callerName, callerPhone, `From call on ${new Date().toLocaleDateString()}`);
          }
        }
      } catch (e) {
        console.error("Error auto-creating contact:", e);
      }
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
