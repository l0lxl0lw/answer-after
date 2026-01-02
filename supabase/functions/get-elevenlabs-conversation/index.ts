import { createAnonClient, createServiceClient } from "../_shared/db.ts";
import { corsPreflightResponse, errorResponse, successResponse } from "../_shared/errors.ts";
import { createLogger } from "../_shared/logger.ts";
import { getElevenLabsApiKey, getConversation } from "../_shared/elevenlabs.ts";

const logger = createLogger('get-elevenlabs-conversation');

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
  recording_url?: string;
}

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
    return corsPreflightResponse();
  }

  try {
    const log = logger.withContext({ requestId: crypto.randomUUID() });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errorResponse("No authorization header", 401);
    }

    const url = new URL(req.url);
    const conversationId = url.searchParams.get("conversation_id");

    if (!conversationId) {
      return errorResponse("conversation_id is required", 400);
    }

    log.info("Fetching conversation details", { conversationId });

    const supabase = createAnonClient();
    const supabaseAdmin = createServiceClient();
    const token = authHeader.replace("Bearer ", "");

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return errorResponse("Unauthorized", 401);
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    const organizationId = profile?.organization_id;

    const elevenlabsApiKey = getElevenLabsApiKey();

    const data: ElevenLabsConversationDetail = await getConversation(conversationId, elevenlabsApiKey);
    log.info("Conversation data fetched successfully");

    // Extract client data from data collection results
    let callerName: string | null = null;
    let callerPhone: string | null = null;

    let callerAddress: string | null = null;

    if (data.analysis?.data_collection_results) {
      const results = data.analysis.data_collection_results;
      if (results.caller_name) callerName = results.caller_name.value;
      if (results.customer_name) callerName = results.customer_name.value;
      if (results.name) callerName = results.name.value;
      if (results.caller_phone) callerPhone = results.caller_phone.value;
      if (results.phone) callerPhone = results.phone.value;
      if (results.address) callerAddress = results.address.value;
      if (results.customer_address) callerAddress = results.customer_address.value;
    }

    // Auto-save contact to database if we have phone and org
    if (callerPhone && organizationId) {
      try {
        const { data: contact } = await supabaseAdmin
          .from('contacts')
          .upsert({
            organization_id: organizationId,
            phone: callerPhone,
            name: callerName || null,
            address: callerAddress || null,
            status: 'customer',
            source: 'inbound_call',
          }, {
            onConflict: 'organization_id,phone',
            ignoreDuplicates: false
          })
          .select('id')
          .single();

        // Link call to contact
        if (contact?.id) {
          await supabaseAdmin
            .from('calls')
            .update({ contact_id: contact.id })
            .eq('elevenlabs_conversation_id', conversationId);
          log.info("Contact saved and linked to call", { contactId: contact.id });
        }
      } catch (e) {
        log.warn("Error saving contact to database", { error: (e as Error).message });
      }
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
        log.warn("Error auto-creating contact", { error: (e as Error).message });
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
      recording_url: data.recording_url || null,
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
      // Also include transcript in frontend-expected format
      transcript: (data.transcript || []).map((t) => ({
        role: t.role as "user" | "agent",
        message: t.message,
        time_in_call_secs: t.time_in_call_secs,
      })),
      message_count: data.transcript?.length || 0,
    };

    return successResponse(transformedData);

  } catch (error) {
    logger.error("Handler error", error as Error);
    return errorResponse(error as Error);
  }
});
