import { createServiceClient } from "../_shared/db.ts";
import { corsPreflightResponse, errorResponse, successResponse } from "../_shared/errors.ts";
import { createLogger } from "../_shared/logger.ts";
import { getElevenLabsApiKey, makeElevenLabsRequest } from "../_shared/elevenlabs.ts";

const logger = createLogger('get-elevenlabs-conversations');

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
    return corsPreflightResponse();
  }

  try {
    const log = logger.withContext({ requestId: crypto.randomUUID() });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errorResponse("No authorization header", 401);
    }

    const supabase = createServiceClient();

    // Get current user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return errorResponse("Unauthorized", 401);
    }

    // Get user's organization
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (!profile?.organization_id) {
      return errorResponse("Organization not found", 404);
    }

    // Get organization's ElevenLabs agent ID
    const { data: agentData } = await supabase
      .from("organization_agents")
      .select("elevenlabs_agent_id")
      .eq("organization_id", profile.organization_id)
      .single();

    if (!agentData?.elevenlabs_agent_id) {
      return errorResponse("ElevenLabs agent not configured", 404);
    }

    const elevenlabsApiKey = getElevenLabsApiKey();

    // Parse query parameters
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const perPage = Math.min(parseInt(url.searchParams.get("per_page") || "20"), 100);
    const search = url.searchParams.get("search") || "";
    const cursor = url.searchParams.get("cursor") || "";

    // Build API URL params
    const params = new URLSearchParams({
      agent_id: agentData.elevenlabs_agent_id,
      page_size: perPage.toString(),
      summary_mode: "include",
    });

    if (cursor) params.set("cursor", cursor);
    if (search) params.set("search", search);

    log.info("Fetching ElevenLabs conversations", { agentId: agentData.elevenlabs_agent_id });

    const data = await makeElevenLabsRequest<{
      conversations: ElevenLabsConversation[];
      has_more: boolean;
      next_cursor?: string;
    }>(`/convai/conversations?${params}`, { apiKey: elevenlabsApiKey });

    log.info(`Found ${data.conversations?.length || 0} conversations`);

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

    return successResponse({
      conversations,
      meta: {
        page,
        per_page: perPage,
        total: conversations.length,
        has_more: data.has_more,
        next_cursor: data.next_cursor,
      },
    });

  } catch (error) {
    logger.error("Handler error", error as Error);
    return errorResponse(error as Error);
  }
});
