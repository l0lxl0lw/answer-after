import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient } from "../_shared/db.ts";
import { corsPreflightResponse, errorResponse, successResponse } from "../_shared/errors.ts";
import { createLogger } from "../_shared/logger.ts";
import { config } from "../_shared/config.ts";
import {
  getElevenLabsApiKey,
  getSignedUrl,
  makeElevenLabsRequest,
  importPhoneNumber,
  assignAgentToPhoneNumber,
} from "../_shared/elevenlabs.ts";
import {
  buildPlaceholderValues,
  replacePlaceholders,
  type PlaceholderValues,
} from "../_shared/placeholder-utils.ts";

const logger = createLogger('elevenlabs-agent');

/**
 * Get the base URL for webhook endpoints
 * For local dev with ElevenLabs, you need a tunnel (ngrok) since ElevenLabs can't reach localhost
 * Set LOCAL_TUNNEL_URL env var to your ngrok URL (e.g., https://abc123.ngrok.io)
 */
function getWebhookBaseUrl(): string {
  // For local development, check for tunnel URL first
  if (config.isLocal) {
    const tunnelUrl = Deno.env.get('LOCAL_TUNNEL_URL');
    if (tunnelUrl) {
      console.log(`[Webhook] Using tunnel URL: ${tunnelUrl}`);
      return tunnelUrl;
    }
    // Fallback to docker internal (won't work for external services like ElevenLabs)
    console.warn('[Webhook] LOCAL_TUNNEL_URL not set - webhooks will not work with ElevenLabs!');
    console.warn('[Webhook] Run: ngrok http 54321 and set LOCAL_TUNNEL_URL in .env.local');
    return 'http://host.docker.internal:54321';
  }

  // For hosted Supabase, use the project URL
  return config.supabase.url;
}

/**
 * Build inline webhook tools for the agent
 * These are embedded directly in the agent config, not created as separate tools
 * Organization ID is embedded via 'const' in the schema for security isolation
 */
function buildInlineWebhookTools(organizationId: string, hasCalendar: boolean): any[] {
  const baseUrl = getWebhookBaseUrl();
  const tools: any[] = [];

  // Save contact tool
  tools.push({
    type: "webhook",
    name: "save_contact",
    description: "Save or update customer contact information in the database. Use this tool when the customer provides their name, phone number, address, or email. Always confirm the information with the customer before saving.",
    api_schema: {
      url: `${baseUrl}/functions/v1/agent-save-contact`,
      method: "POST",
      request_headers: { "Content-Type": "application/json" },
      request_body_schema: {
        type: "object",
        properties: {
          organization_id: { type: "string", const: organizationId, description: "Organization ID (auto-filled)" },
          phone: { type: "string", description: "Customer phone number. Required field." },
          name: { type: "string", description: "Customer full name." },
          address: { type: "string", description: "Customer address including street, city, state, and zip code." },
          email: { type: "string", description: "Customer email address." }
        },
        required: ["organization_id", "phone"]
      }
    }
  });

  // Lookup contact tool
  tools.push({
    type: "webhook",
    name: "lookup_contact",
    description: "Look up a customer by their phone number to check if they are a returning customer. Use this at the start of a call if you have the caller's phone number from caller ID. This helps provide personalized service to returning customers.",
    api_schema: {
      url: `${baseUrl}/functions/v1/agent-lookup-contact`,
      method: "POST",
      request_headers: { "Content-Type": "application/json" },
      request_body_schema: {
        type: "object",
        properties: {
          organization_id: { type: "string", const: organizationId, description: "Organization ID (auto-filled)" },
          phone: { type: "string", description: "Phone number to look up. Can be from caller ID." }
        },
        required: ["organization_id", "phone"]
      }
    }
  });

  // Calendar availability tool (if Google Calendar connected)
  if (hasCalendar) {
    tools.push({
      type: "webhook",
      name: "check_calendar_availability",
      description: "Check the business calendar to find available appointment slots. Use this tool when a customer wants to schedule an appointment or asks about availability. The tool will return available time slots based on the business calendar and existing appointments.",
      api_schema: {
        url: `${baseUrl}/functions/v1/calendar-availability`,
        method: "POST",
        request_headers: { "Content-Type": "application/json" },
        request_body_schema: {
          type: "object",
          properties: {
            organization_id: { type: "string", const: organizationId, description: "Organization ID (auto-filled)" },
            date_preference: {
              type: "string",
              description: "When the customer wants the appointment. Use 'today' for same-day, 'tomorrow' for next day, 'this_week' for current week, or 'next_week' for looking further ahead.",
              enum: ["today", "tomorrow", "this_week", "next_week"]
            },
            duration_minutes: {
              type: "number",
              description: "How long the appointment should be in minutes. Use 60 for standard appointments, 30 for quick consultations.",
              default: 60
            }
          },
          required: ["organization_id", "date_preference"]
        }
      }
    });
  }

  // Book appointment tool
  tools.push({
    type: "webhook",
    name: "book_appointment",
    description: "Book a new appointment for the customer. Use this AFTER checking availability with check_calendar_availability and confirming the time with the customer. Requires customer name, phone number, and the appointment date/time.",
    api_schema: {
      url: `${baseUrl}/functions/v1/agent-book-appointment`,
      method: "POST",
      request_headers: { "Content-Type": "application/json" },
      request_body_schema: {
        type: "object",
        properties: {
          organization_id: { type: "string", const: organizationId, description: "Organization ID (auto-filled)" },
          customer_name: { type: "string", description: "Customer's full name" },
          customer_phone: { type: "string", description: "Customer's phone number" },
          appointment_datetime: { type: "string", description: "Appointment date and time in ISO 8601 format (e.g., 2024-01-15T10:00:00)" },
          duration_minutes: { type: "number", description: "Appointment duration in minutes. Default is 60.", default: 60 },
          provider_id: { type: "string", description: "Optional: Specific provider/staff member ID if customer has a preference" },
          service_type: { type: "string", description: "Type of service or reason for appointment" },
          notes: { type: "string", description: "Any additional notes about the appointment" }
        },
        required: ["organization_id", "customer_name", "customer_phone", "appointment_datetime"]
      }
    }
  });

  // Cancel appointment tool
  tools.push({
    type: "webhook",
    name: "cancel_appointment",
    description: "Cancel an existing appointment for the customer. Looks up the appointment by the customer's phone number. If the customer has multiple upcoming appointments, ask which one they want to cancel.",
    api_schema: {
      url: `${baseUrl}/functions/v1/agent-cancel-appointment`,
      method: "POST",
      request_headers: { "Content-Type": "application/json" },
      request_body_schema: {
        type: "object",
        properties: {
          organization_id: { type: "string", const: organizationId, description: "Organization ID (auto-filled)" },
          customer_phone: { type: "string", description: "Customer's phone number to look up their appointment" },
          appointment_datetime: { type: "string", description: "Optional: Specific appointment date/time to cancel if customer has multiple appointments" }
        },
        required: ["organization_id", "customer_phone"]
      }
    }
  });

  // Reschedule appointment tool
  tools.push({
    type: "webhook",
    name: "reschedule_appointment",
    description: "Reschedule an existing appointment to a new date/time. First check availability for the new time using check_calendar_availability before using this tool. Requires the customer's phone number and the new desired time.",
    api_schema: {
      url: `${baseUrl}/functions/v1/agent-reschedule-appointment`,
      method: "POST",
      request_headers: { "Content-Type": "application/json" },
      request_body_schema: {
        type: "object",
        properties: {
          organization_id: { type: "string", const: organizationId, description: "Organization ID (auto-filled)" },
          customer_phone: { type: "string", description: "Customer's phone number to look up their existing appointment" },
          current_appointment_datetime: { type: "string", description: "Optional: Current appointment date/time if customer has multiple appointments" },
          new_datetime: { type: "string", description: "New appointment date and time in ISO 8601 format" },
          new_duration_minutes: { type: "number", description: "Optional: New duration in minutes if changing from original" }
        },
        required: ["organization_id", "customer_phone", "new_datetime"]
      }
    }
  });

  return tools;
}

/**
 * Check if organization has Google Calendar connected
 */
async function hasGoogleCalendarConnection(supabase: any, organizationId: string): Promise<boolean> {
  const { data } = await supabase
    .from('google_calendar_connections')
    .select('id')
    .eq('organization_id', organizationId)
    .maybeSingle();

  return !!data;
}


serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return corsPreflightResponse();
  }

  try {
    const url = new URL(req.url);
    const log = logger.withContext({ path: url.pathname });

    const supabase = createServiceClient();

    // Handle POST requests for agent creation
    if (req.method === 'POST') {
      const body = await req.json();

      if (body.action === 'create-agent') {
        return await handleCreateAgent(supabase, body.organizationId, body.context);
      }

      if (body.action === 'update-agent') {
        return await handleUpdateAgent(supabase, body.organizationId, body.context, body.voiceId);
      }

      if (body.action === 'rename-agent') {
        return await handleRenameAgent(supabase, body.organizationId, body.name);
      }

      if (body.action === 'import-phone') {
        return await handleImportPhone(supabase, body.organizationId, body.agentId, body.phoneNumber);
      }
    }

    // Handle WebSocket upgrade for Twilio <-> ElevenLabs bridge
    const upgradeHeader = req.headers.get("upgrade") || "";
    if (upgradeHeader.toLowerCase() === "websocket") {
      return handleWebSocketConnection(req, url, supabase);
    }

    return errorResponse('Not found', 404);

  } catch (error) {
    logger.error('Handler error', error as Error);
    return errorResponse(error as Error);
  }
});

async function handleWebSocketConnection(req: Request, url: URL, supabase: any) {
  const { socket: twilioWs, response } = Deno.upgradeWebSocket(req);

  const agentId = url.searchParams.get('agentId');
  const callSid = url.searchParams.get('callSid');

  if (!agentId) {
    console.error('Missing agentId parameter');
    twilioWs.close(1000, 'Missing agentId parameter');
    return response;
  }

  console.log(`WebSocket connection for call ${callSid}, agent ${agentId}`);

  let apiKey: string;
  try {
    apiKey = getElevenLabsApiKey();
  } catch {
    console.error('ELEVENLABS_API_KEY not configured');
    twilioWs.close(1000, 'API key not configured');
    return response;
  }

  let elevenLabsWs: WebSocket | null = null;
  let streamSid: string | null = null;
  let conversationId: string | null = null;

  async function connectToElevenLabs() {
    try {
      console.log('Getting ElevenLabs signed URL...');
      const signedUrl = await getSignedUrl(agentId!, apiKey);
      console.log('Got signed URL, connecting to ElevenLabs...');

      elevenLabsWs = new WebSocket(signedUrl);

      elevenLabsWs.onopen = () => {
        console.log('Connected to ElevenLabs WebSocket');
      };

      elevenLabsWs.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleElevenLabsMessage(message);
        } catch (error) {
          console.error('Error parsing ElevenLabs message:', error);
        }
      };

      elevenLabsWs.onerror = (error) => {
        console.error('ElevenLabs WebSocket error:', error);
      };

      elevenLabsWs.onclose = () => {
        console.log('ElevenLabs WebSocket closed');
      };
    } catch (error) {
      console.error('Error connecting to ElevenLabs:', error);
    }
  }

  function handleElevenLabsMessage(message: any) {
    switch (message.type) {
      case 'audio':
        if (streamSid && twilioWs.readyState === WebSocket.OPEN) {
          const audioChunk = message.audio?.chunk || message.audio_event?.audio_base_64;
          if (audioChunk) {
            twilioWs.send(JSON.stringify({
              event: 'media',
              streamSid,
              media: { payload: audioChunk }
            }));
          }
        }
        break;

      case 'interruption':
        if (streamSid && twilioWs.readyState === WebSocket.OPEN) {
          twilioWs.send(JSON.stringify({ event: 'clear', streamSid }));
        }
        break;

      case 'ping':
        if (message.ping_event?.event_id && elevenLabsWs?.readyState === WebSocket.OPEN) {
          elevenLabsWs.send(JSON.stringify({
            type: 'pong',
            event_id: message.ping_event.event_id
          }));
        }
        break;

      case 'conversation_initiation_metadata':
        console.log('ElevenLabs conversation started:', message);
        // Extract and save conversation_id for later lookup of recording/transcript
        conversationId = message.conversation_initiation_metadata_event?.conversation_id
          || message.conversation_id;
        if (conversationId && callSid) {
          console.log(`Saving conversation_id ${conversationId} for call ${callSid}`);
          supabase
            .from('calls')
            .update({ elevenlabs_conversation_id: conversationId })
            .eq('twilio_call_sid', callSid)
            .then(({ error }: { error: any }) => {
              if (error) {
                console.error('Error saving conversation_id:', error);
              } else {
                console.log('Conversation ID saved to database');
              }
            });
        }
        break;

      case 'agent_response':
        console.log('Agent response:', message.agent_response_event?.agent_response);
        break;

      case 'user_transcript':
        console.log('User said:', message.user_transcription_event?.user_transcript);
        break;

      default:
        console.log('ElevenLabs message:', message.type);
    }
  }

  twilioWs.onopen = () => {
    console.log('Twilio WebSocket connected');
  };

  twilioWs.onmessage = async (event) => {
    try {
      const message = JSON.parse(event.data);

      switch (message.event) {
        case 'connected':
          console.log('Twilio stream connected');
          break;

        case 'start':
          streamSid = message.start.streamSid;
          console.log(`Twilio stream started: ${streamSid}`);
          await connectToElevenLabs();

          if (callSid) {
            await supabase
              .from('calls')
              .update({ status: 'active' })
              .eq('twilio_call_sid', callSid);
          }
          break;

        case 'media':
          if (elevenLabsWs?.readyState === WebSocket.OPEN) {
            elevenLabsWs.send(JSON.stringify({ user_audio_chunk: message.media.payload }));
          }
          break;

        case 'stop':
          console.log('Twilio stream stopped');
          if (elevenLabsWs?.readyState === WebSocket.OPEN) {
            elevenLabsWs.close();
          }
          break;

        default:
          console.log('Twilio event:', message.event);
      }
    } catch (error) {
      console.error('Error processing Twilio message:', error);
    }
  };

  twilioWs.onclose = () => {
    console.log('Twilio WebSocket closed');
    if (elevenLabsWs?.readyState === WebSocket.OPEN) {
      elevenLabsWs.close();
    }
  };

  twilioWs.onerror = (error) => {
    console.error('Twilio WebSocket error:', error);
    if (elevenLabsWs?.readyState === WebSocket.OPEN) {
      elevenLabsWs.close();
    }
  };

  return response;
}

async function handleCreateAgent(supabase: any, organizationId: string, context?: string) {
  const log = logger.withContext({ organizationId, action: 'create-agent' });

  let apiKey: string;
  try {
    apiKey = getElevenLabsApiKey();
  } catch (error) {
    return errorResponse('ElevenLabs API key not configured', 500);
  }

  if (!organizationId) {
    return errorResponse('Organization ID is required', 400);
  }

  log.step('Creating ElevenLabs agent');

  const { data: orgData, error: orgError } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', organizationId)
    .single();

  if (orgError) {
    log.error('Error fetching organization', orgError);
    return errorResponse('Organization not found', 404);
  }

  // Get or create organization_agents record
  let { data: agentRecord } = await supabase
    .from('organization_agents')
    .select('*')
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (!agentRecord) {
    const { data: newRecord } = await supabase
      .from('organization_agents')
      .insert({ organization_id: organizationId, context: context || null })
      .select()
      .single();
    agentRecord = newRecord;
  }

  const agentContext = context || agentRecord?.context || '';

  // Check if Google Calendar is connected
  const hasCalendar = await hasGoogleCalendarConnection(supabase, organizationId);
  log.info('Calendar connection status', { hasCalendar });

  // Build inline webhook tools (contact tools + calendar if available)
  const inlineTools = buildInlineWebhookTools(organizationId, hasCalendar);
  log.info('Built inline tools', { toolCount: inlineTools.length, toolNames: inlineTools.map((t: any) => t.name) });

  // Build prompt with tool instructions
  const { prompt: systemPrompt, firstMessage } = await buildAgentPrompt(supabase, orgData, agentContext, hasCalendar, true);

  const DEFAULT_VOICE_ID = '625jGFaa0zTLtQfxwc6Q';

  let llmModel = 'gemini-2.5-flash';
  try {
    const parsed = JSON.parse(agentContext);
    if (parsed.llmModel) llmModel = parsed.llmModel;
  } catch { }

  const envPrefix = config.isLocal ? '[LOCAL]' : config.isDevelopment ? '[DEV]' : '';
  const modePrefix = '[INBOUND]';
  const agentName = `${envPrefix}${modePrefix} ${orgData.name} - ${organizationId}`;

  // Build agent config with inline tools
  const agentConfig: any = {
    name: agentName,
    conversation_config: {
      agent: {
        first_message: firstMessage,
        prompt: { prompt: systemPrompt },
        llm: { model: llmModel },
        tools: inlineTools  // Inline webhook tools with api_schema
      },
      tts: { voice_id: DEFAULT_VOICE_ID }
    },
    platform_settings: {
      widget: { avatar: { type: "orb" } }
    }
  };

  try {
    log.info('Creating ElevenLabs agent');

    const agentData = await makeElevenLabsRequest<{ agent_id: string }>(
      '/convai/agents/create',
      { apiKey, method: 'POST', body: agentConfig }
    );

    log.info('ElevenLabs agent created', { agentId: agentData.agent_id });

    await supabase
      .from('organization_agents')
      .update({ elevenlabs_agent_id: agentData.agent_id, context: agentContext || null })
      .eq('organization_id', organizationId);

    // Import phone number to ElevenLabs
    try {
      await importPhoneNumberToElevenLabs(supabase, organizationId, agentData.agent_id, agentName, apiKey);
    } catch (importError) {
      const err = importError as Error;
      log.error('Phone import failed', {
        error: err.message,
        stack: err.stack,
        organizationId,
        agentId: agentData.agent_id
      });
      console.error('[ElevenLabs Phone Import] FAILED:', err.message, err.stack);
    }

    return successResponse({
      success: true,
      agent_id: agentData.agent_id,
      message: 'Agent created successfully'
    });

  } catch (error) {
    log.error('Error creating ElevenLabs agent', error as Error);
    return errorResponse(error as Error);
  }
}

async function importPhoneNumberToElevenLabs(
  supabase: any,
  organizationId: string,
  agentId: string,
  agentLabel: string,
  apiKey: string,
  phoneNumberParam?: string  // Optional: if provided, query by phone number directly
): Promise<void> {
  console.log(`[ElevenLabs Phone Import] Starting for org: ${organizationId}, agent: ${agentId}, phone: ${phoneNumberParam || 'not provided'}`);

  // Always use the org's actual subaccount credentials - this is where the phone was purchased
  const { data: orgData, error: orgError } = await supabase
    .from('organizations')
    .select('twilio_subaccount_sid, twilio_subaccount_auth_token')
    .eq('id', organizationId)
    .single();

  if (orgError) {
    console.error('[ElevenLabs Phone Import] Error fetching org:', orgError);
  }

  let twilioSid = orgData?.twilio_subaccount_sid;
  let twilioToken = orgData?.twilio_subaccount_auth_token;

  // Fallback to local subaccount only if org has no subaccount (for testing with pre-existing phones)
  if (!twilioSid || !twilioToken) {
    const USE_LOCAL_SUBACCOUNT = Deno.env.get('USE_LOCAL_SUBACCOUNT') === 'true';
    if (USE_LOCAL_SUBACCOUNT || config.isLocal) {
      twilioSid = Deno.env.get('LOCAL_SUBACCOUNT_SID');
      twilioToken = Deno.env.get('LOCAL_SUBACCOUNT_AUTH_TOKEN');
      console.log(`[ElevenLabs Phone Import] Org has no subaccount, falling back to local: ${twilioSid ? twilioSid.substring(0, 10) + '...' : 'MISSING'}`);
    }
  } else {
    console.log(`[ElevenLabs Phone Import] Using org subaccount: ${twilioSid.substring(0, 10)}...`);
  }

  if (!twilioSid || !twilioToken) {
    throw new Error(`[ElevenLabs Phone Import] No Twilio credentials available - twilioSid: ${!!twilioSid}, twilioToken: ${!!twilioToken}`);
  }

  // Query phone: prefer by phone number if provided, otherwise by org_id
  let phoneData;
  let phoneError;

  if (phoneNumberParam) {
    // Query by phone number directly (more reliable in LOCAL mode)
    console.log(`[ElevenLabs Phone Import] Querying by phone number: ${phoneNumberParam}`);
    const result = await supabase
      .from('phone_numbers')
      .select('id, phone_number, elevenlabs_phone_number_id')
      .eq('phone_number', phoneNumberParam)
      .maybeSingle();
    phoneData = result.data;
    phoneError = result.error;
  } else {
    // Fallback: query by organization_id
    console.log(`[ElevenLabs Phone Import] Querying by organization_id: ${organizationId}`);
    const result = await supabase
      .from('phone_numbers')
      .select('id, phone_number, elevenlabs_phone_number_id')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .maybeSingle();
    phoneData = result.data;
    phoneError = result.error;
  }

  if (phoneError) {
    throw new Error(`[ElevenLabs Phone Import] Error fetching phone: ${JSON.stringify(phoneError)}`);
  }

  if (!phoneData) {
    throw new Error(`[ElevenLabs Phone Import] No phone number found - phoneNumber: ${phoneNumberParam}, orgId: ${organizationId}`);
  }

  console.log(`[ElevenLabs Phone Import] Found phone: ${phoneData.phone_number}, elevenlabs_id: ${phoneData.elevenlabs_phone_number_id || 'none'}`);

  // If already imported, just assign agent
  if (phoneData.elevenlabs_phone_number_id) {
    console.log('[ElevenLabs Phone Import] Phone already imported, assigning agent to:', phoneData.elevenlabs_phone_number_id);
    await assignAgentToPhoneNumber(phoneData.elevenlabs_phone_number_id, agentId, apiKey);
    console.log('[ElevenLabs Phone Import] Agent assigned successfully');
    return;
  }

  // Import phone number
  console.log(`[ElevenLabs Phone Import] Importing phone ${phoneData.phone_number} to ElevenLabs...`);
  console.log(`[ElevenLabs Phone Import] Using Twilio SID: ${twilioSid}, Token: ${twilioToken?.substring(0, 8)}...`);

  let importResult;
  try {
    importResult = await importPhoneNumber(
      phoneData.phone_number,
      agentLabel,
      twilioSid,
      twilioToken,
      apiKey
    );
    console.log('[ElevenLabs Phone Import] Import result:', JSON.stringify(importResult));
  } catch (importErr) {
    const err = importErr as Error;
    console.error('[ElevenLabs Phone Import] ElevenLabs API error:', err.message);
    console.error('[ElevenLabs Phone Import] Full error:', JSON.stringify({
      message: err.message,
      stack: err.stack,
      phone: phoneData.phone_number,
      twilioSid,
    }));
    throw importErr; // Re-throw to be caught by outer handler
  }

  // Save phone number ID
  const { error: updateError } = await supabase
    .from('phone_numbers')
    .update({ elevenlabs_phone_number_id: importResult.phone_number_id })
    .eq('id', phoneData.id);

  if (updateError) {
    console.error('[ElevenLabs Phone Import] Error saving phone_number_id:', updateError);
  } else {
    console.log('[ElevenLabs Phone Import] Saved elevenlabs_phone_number_id:', importResult.phone_number_id);
  }

  // Assign agent
  console.log('[ElevenLabs Phone Import] Assigning agent to phone...');
  await assignAgentToPhoneNumber(importResult.phone_number_id, agentId, apiKey);
  console.log('[ElevenLabs Phone Import] Successfully imported phone and assigned agent');
}

async function buildAgentPrompt(supabase: any, orgData: any, context: string, hasCalendarTool: boolean = false, hasContactTools: boolean = false): Promise<{ prompt: string; firstMessage: string }> {
  let greeting = '';
  let customInstructions = '';

  try {
    const parsed = JSON.parse(context);
    greeting = parsed.greeting || '';
    customInstructions = parsed.customInstructions || parsed.content || '';
  } catch {
    customInstructions = context;
  }

  // Fetch templates from database
  const { data: templates } = await supabase
    .from('prompt_templates')
    .select('name, template')
    .eq('is_active', true);

  const templateMap: Record<string, string> = {};
  if (templates) {
    for (const t of templates) {
      templateMap[t.name] = t.template;
    }
  }

  // Fetch services for this organization
  const { data: services } = await supabase
    .from('services')
    .select('name, price_cents, duration_minutes')
    .eq('organization_id', orgData.id)
    .eq('is_active', true);

  // Build placeholder values using shared utility
  const placeholderValues = buildPlaceholderValues(
    orgData,
    services || [],
    { context }
  );

  const basePromptTemplate = templateMap['agent_base_prompt'] || getDefaultBasePrompt();
  const firstMessageTemplate = templateMap['agent_first_message'] || 'Hello! Thanks for calling {{orgName}}. How can I help you today?';
  const contextPrefix = templateMap['agent_context_prefix'] || 'ADDITIONAL BUSINESS CONTEXT:';

  // Use shared replacePlaceholders function
  const firstMessage = greeting || replacePlaceholders(firstMessageTemplate, placeholderValues);
  let fullPrompt = replacePlaceholders(basePromptTemplate, placeholderValues);

  // Append custom instructions if provided (this is separate from the {{customInstructions}} placeholder)
  if (customInstructions && customInstructions.trim()) {
    fullPrompt = `${fullPrompt}\n\n${contextPrefix}\n${customInstructions}`;
  }

  // Add calendar tool instructions if the tool is available
  if (hasCalendarTool) {
    const calendarToolInstructions = `

APPOINTMENT MANAGEMENT:
You have access to appointment management tools to help customers book, cancel, and reschedule appointments.

Tools available:
- check_calendar_availability: Check for open appointment slots
- book_appointment: Create a new appointment
- cancel_appointment: Cancel an existing appointment
- reschedule_appointment: Change an existing appointment to a new time

BOOKING A NEW APPOINTMENT:
1. Ask what type of appointment they need and when they'd prefer (today, tomorrow, this week, next week)
2. Use check_calendar_availability to find open slots
3. Present 2-3 available options: "I have openings at 10 AM or 2 PM on Tuesday. Which works better?"
4. Ask if they have a provider preference: "Do you have a preference for which provider you'd like to see?"
5. Collect customer information (name, phone number if not already known)
6. Confirm all details before booking: "So that's [name], [phone], for [time] - is that correct?"
7. Use book_appointment to create the appointment
8. Confirm the booking: "Great, I've booked your appointment for [time]."

CANCELLING AN APPOINTMENT:
1. Confirm the customer wants to cancel their appointment
2. Use cancel_appointment with their phone number
3. If they have multiple appointments, ask which one to cancel
4. Confirm the cancellation

RESCHEDULING AN APPOINTMENT:
1. Confirm they want to reschedule, not cancel
2. Ask for their new preferred time
3. Use check_calendar_availability to verify the new time is open
4. Use reschedule_appointment to update the appointment
5. Confirm the new appointment time

IMPORTANT:
- Always use check_calendar_availability BEFORE booking to ensure the slot is available
- Always confirm appointment details before booking or changing
- If a time isn't available, offer alternatives
- Use the customer's phone number to look up existing appointments
- Be proactive about collecting missing information (name, phone, service type)`;

    fullPrompt = `${fullPrompt}\n${calendarToolInstructions}`;
  }

  // Add contact tools instructions if available
  if (hasContactTools) {
    const contactToolInstructions = `

CONTACT MANAGEMENT:
You have access to contact tools to manage customer information.

Tools available:
- lookup_contact: Look up a customer by phone number to identify returning customers
- save_contact: Save or update customer contact information (name, phone, address, email)

When to use these tools:
1. At the start of a call, if you have the caller's phone number from caller ID, use lookup_contact to check if they're a returning customer
2. When a customer provides their name, phone, address, or email, use save_contact to store their information
3. Always confirm information with the customer before saving

Example flow for new callers:
- Customer provides info: "My name is John Smith, my number is 555-1234, and I'm at 123 Main St"
- You confirm: "Let me make sure I have that right - John Smith, 555-1234, 123 Main Street?"
- After confirmation: Use save_contact tool
- Then say: "Great, I've saved your information in our system."

Example flow for returning callers:
- Use lookup_contact with their phone number
- If found: "Welcome back, [name]! How can I help you today?"
- If not found: "I don't see your information on file. Could I get your name and contact details?"`;

    fullPrompt = `${fullPrompt}\n${contactToolInstructions}`;
  }

  return { prompt: fullPrompt, firstMessage };
}

function getDefaultBasePrompt(): string {
  return `You are a friendly AI receptionist for {{orgName}}, a professional service company.

Your responsibilities:
1. Greet callers warmly
2. Ask how you can help them today
3. Gather information about their issue (what's wrong, urgency level)
4. Collect their contact information (name, phone, address)
5. Help schedule appointments if needed
6. Handle emergencies by noting them as urgent

Keep your responses SHORT and conversational - this is a phone call. 2-3 sentences max.
Be warm, professional, and helpful.

If the caller describes an emergency (severe tooth pain, dental abscess, broken tooth, knocked-out tooth, swelling), acknowledge the urgency and assure them we will get them seen as soon as possible.

Business hours: {{businessHoursStart}} to {{businessHoursEnd}}

When you have gathered enough information (name, phone, address, issue description), summarize the appointment details and confirm with the caller.`;
}

async function handleUpdateAgent(supabase: any, organizationId: string, context?: string, voiceId?: string) {
  const log = logger.withContext({ organizationId, action: 'update-agent' });

  let apiKey: string;
  try {
    apiKey = getElevenLabsApiKey();
  } catch {
    return errorResponse('ElevenLabs API key not configured', 500);
  }

  if (!organizationId) {
    return errorResponse('Organization ID is required', 400);
  }

  log.step('Updating ElevenLabs agent');

  const { data: orgData } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', organizationId)
    .single();

  if (!orgData) {
    return errorResponse('Organization not found', 404);
  }

  const { data: agentRecord } = await supabase
    .from('organization_agents')
    .select('*')
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (!agentRecord?.elevenlabs_agent_id) {
    log.info('No existing agent found, creating new one');
    return handleCreateAgent(supabase, organizationId, context);
  }

  const agentContext = context || agentRecord?.context || '';

  // Check if Google Calendar is connected
  const hasCalendar = await hasGoogleCalendarConnection(supabase, organizationId);
  log.info('Calendar connection status', { hasCalendar });

  // Build inline webhook tools (contact tools + calendar if available)
  const inlineTools = buildInlineWebhookTools(organizationId, hasCalendar);
  log.info('Built inline tools for update', { toolCount: inlineTools.length, toolNames: inlineTools.map((t: any) => t.name) });

  // Build prompt with tool instructions
  const { prompt: systemPrompt, firstMessage } = await buildAgentPrompt(supabase, orgData, agentContext, hasCalendar, true);

  let llmModel = 'gemini-2.5-flash';
  try {
    const parsed = JSON.parse(agentContext);
    if (parsed.llmModel) llmModel = parsed.llmModel;
  } catch { }

  const updateConfig: any = {
    conversation_config: {
      agent: {
        first_message: firstMessage,
        prompt: { prompt: systemPrompt },
        llm: { model: llmModel },
        tools: inlineTools  // Inline webhook tools with api_schema
      }
    }
  };

  if (voiceId) {
    updateConfig.conversation_config.tts = { voice_id: voiceId };
    log.info('Setting voice ID', { voiceId });
  }

  try {
    await makeElevenLabsRequest(
      `/convai/agents/${agentRecord.elevenlabs_agent_id}`,
      { apiKey, method: 'PATCH', body: updateConfig }
    );

    log.info('ElevenLabs agent updated');

    await supabase
      .from('organization_agents')
      .update({ context: agentContext || null })
      .eq('organization_id', organizationId);

    // Import phone number if not already imported (ensures phone is linked to agent)
    const envPrefix = config.isLocal ? '[LOCAL]' : config.isDevelopment ? '[DEV]' : '';
    const modePrefix = '[INBOUND]';
    const agentLabel = `${envPrefix}${modePrefix} ${orgData.name} - ${organizationId}`;

    try {
      await importPhoneNumberToElevenLabs(supabase, organizationId, agentRecord.elevenlabs_agent_id, agentLabel, apiKey);
      log.info('Phone import completed during update');
    } catch (importError) {
      const err = importError as Error;
      log.error('Phone import failed during update', {
        error: err.message,
        stack: err.stack,
        organizationId,
        agentId: agentRecord.elevenlabs_agent_id
      });
      // Don't fail the whole update if phone import fails
    }

    return successResponse({
      success: true,
      agent_id: agentRecord.elevenlabs_agent_id,
      message: 'Agent updated successfully'
    });

  } catch (error) {
    log.error('Error updating ElevenLabs agent', error as Error);
    return errorResponse(error as Error);
  }
}

async function handleRenameAgent(supabase: any, organizationId: string, name: string) {
  const log = logger.withContext({ organizationId, action: 'rename-agent' });

  let apiKey: string;
  try {
    apiKey = getElevenLabsApiKey();
  } catch {
    return errorResponse('ElevenLabs API key not configured', 500);
  }

  if (!organizationId || !name) {
    return errorResponse('Organization ID and name are required', 400);
  }

  log.step('Renaming ElevenLabs agent', { newName: name });

  const { data: agentRecord } = await supabase
    .from('organization_agents')
    .select('elevenlabs_agent_id')
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (!agentRecord?.elevenlabs_agent_id) {
    return successResponse({ success: true, message: 'No agent exists to rename' });
  }

  const envPrefix = config.isLocal ? '[LOCAL]' : config.isDevelopment ? '[DEV]' : '';
  const modePrefix = '[INBOUND]';
  const agentName = `${envPrefix}${modePrefix} ${name} - ${organizationId}`;

  try {
    await makeElevenLabsRequest(
      `/convai/agents/${agentRecord.elevenlabs_agent_id}`,
      { apiKey, method: 'PATCH', body: { name: agentName } }
    );

    log.info('ElevenLabs agent renamed');

    return successResponse({
      success: true,
      agent_id: agentRecord.elevenlabs_agent_id,
      message: 'Agent renamed successfully'
    });

  } catch (error) {
    log.error('Error renaming ElevenLabs agent', error as Error);
    return errorResponse(error as Error);
  }
}

async function handleImportPhone(supabase: any, organizationId: string, agentId: string, phoneNumber?: string) {
  const log = logger.withContext({ organizationId, agentId, phoneNumber, action: 'import-phone' });

  let apiKey: string;
  try {
    apiKey = getElevenLabsApiKey();
  } catch {
    return errorResponse('ElevenLabs API key not configured', 500);
  }

  if (!organizationId || !agentId) {
    return errorResponse('Organization ID and Agent ID are required', 400);
  }

  log.step('Importing phone to ElevenLabs', { phoneNumber });

  // Get org name for label
  const { data: orgData } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', organizationId)
    .single();

  const envPrefix = config.isLocal ? '[LOCAL]' : config.isDevelopment ? '[DEV]' : '';
  const modePrefix = '[INBOUND]';
  const agentLabel = `${envPrefix}${modePrefix} ${orgData?.name || 'Unknown'} - ${organizationId}`;

  try {
    await importPhoneNumberToElevenLabs(supabase, organizationId, agentId, agentLabel, apiKey, phoneNumber);

    // Get the phone number ID that was just imported
    const { data: phoneData } = await supabase
      .from('phone_numbers')
      .select('elevenlabs_phone_number_id')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .maybeSingle();

    return successResponse({
      success: true,
      phone_number_id: phoneData?.elevenlabs_phone_number_id,
      message: 'Phone imported successfully'
    });

  } catch (error) {
    const err = error as Error;
    log.error('Error importing phone', err);
    return errorResponse(err);
  }
}
