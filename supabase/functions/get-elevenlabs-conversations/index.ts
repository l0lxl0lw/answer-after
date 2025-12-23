import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ElevenLabsConversation {
  conversation_id: string;
  agent_id: string;
  status: string;
  start_time_unix_secs: number;
  call_duration_secs: number;
  message_count: number;
  transcript_summary?: string;
  call_successful?: string;
  analysis?: {
    transcript_summary?: string;
    call_successful?: string;
  };
}

interface ElevenLabsConversationsResponse {
  conversations: ElevenLabsConversation[];
  has_more: boolean;
  next_cursor?: string;
}

interface TransformedConversation {
  id: string;
  conversation_id: string;
  status: string;
  started_at: string;
  duration_seconds: number;
  message_count: number;
  summary: string | null;
  call_successful: string | null;
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

    // Get user's organization
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.organization_id) {
      return new Response(JSON.stringify({ error: "Organization not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get organization's ElevenLabs agent ID
    const { data: agentData, error: agentError } = await supabase
      .from("organization_agents")
      .select("elevenlabs_agent_id")
      .eq("organization_id", profile.organization_id)
      .single();

    if (agentError || !agentData?.elevenlabs_agent_id) {
      return new Response(JSON.stringify({ error: "ElevenLabs agent not configured" }), {
        status: 404,
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

    // Parse query parameters
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const perPage = Math.min(parseInt(url.searchParams.get("per_page") || "20"), 100);
    const search = url.searchParams.get("search") || "";
    const cursor = url.searchParams.get("cursor") || "";

    // Build ElevenLabs API URL
    const apiUrl = new URL("https://api.elevenlabs.io/v1/convai/conversations");
    apiUrl.searchParams.set("agent_id", agentData.elevenlabs_agent_id);
    apiUrl.searchParams.set("page_size", perPage.toString());
    apiUrl.searchParams.set("summary_mode", "include");
    
    if (cursor) {
      apiUrl.searchParams.set("cursor", cursor);
    }
    if (search) {
      apiUrl.searchParams.set("search", search);
    }

    console.log("Fetching ElevenLabs conversations:", apiUrl.toString());

    const response = await fetch(apiUrl.toString(), {
      headers: {
        "xi-api-key": elevenlabsApiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs API error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Failed to fetch conversations" }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data: ElevenLabsConversationsResponse = await response.json();
    console.log(`Found ${data.conversations?.length || 0} conversations`);

    // Transform conversations to our format
    const conversations: TransformedConversation[] = (data.conversations || []).map((conv) => ({
      id: conv.conversation_id,
      conversation_id: conv.conversation_id,
      status: conv.status === "done" ? "completed" : conv.status,
      started_at: new Date(conv.start_time_unix_secs * 1000).toISOString(),
      duration_seconds: conv.call_duration_secs || 0,
      message_count: conv.message_count || 0,
      summary: conv.transcript_summary || conv.analysis?.transcript_summary || null,
      call_successful: conv.call_successful || conv.analysis?.call_successful || null,
    }));

    return new Response(
      JSON.stringify({
        conversations,
        meta: {
          page,
          per_page: perPage,
          total: conversations.length,
          has_more: data.has_more,
          next_cursor: data.next_cursor,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error fetching conversations:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
