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
  createCalendarTool,
  getTool,
} from "../_shared/elevenlabs.ts";
import {
  buildPlaceholderValues,
  replacePlaceholders,
  type PlaceholderValues,
} from "../_shared/placeholder-utils.ts";

const logger = createLogger('elevenlabs-agent');

/**
 * Build the webhook URL for the calendar-availability endpoint
 */
function getCalendarAvailabilityWebhookUrl(): string {
  const supabaseUrl = config.supabase.url;

  // For local development, use the local functions URL
  if (config.isLocal) {
    return 'http://host.docker.internal:54321/functions/v1/calendar-availability';
  }

  // For hosted Supabase, construct the functions URL
  // URL format: https://<project-ref>.supabase.co -> https://<project-ref>.supabase.co/functions/v1/<function>
  return `${supabaseUrl}/functions/v1/calendar-availability`;
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

/**
 * Setup calendar tool for an agent
 * Creates the tool if it doesn't exist, returns tool ID if calendar is connected
 */
async function setupCalendarTool(
  supabase: any,
  organizationId: string,
  existingToolId: string | null,
  apiKey: string
): Promise<string | null> {
  const log = logger.withContext({ organizationId, action: 'setup-calendar-tool' });

  // Check if org has Google Calendar connected
  const hasCalendar = await hasGoogleCalendarConnection(supabase, organizationId);
  if (!hasCalendar) {
    log.info('No Google Calendar connection, skipping tool setup');
    return null;
  }

  // If we have an existing tool ID, verify it still exists
  if (existingToolId) {
    const existingTool = await getTool(existingToolId, apiKey);
    if (existingTool) {
      log.info('Using existing calendar tool', { toolId: existingToolId });
      return existingToolId;
    }
    log.info('Existing tool not found, creating new one');
  }

  // Create new calendar tool
  const webhookUrl = getCalendarAvailabilityWebhookUrl();
  log.info('Creating calendar tool', { webhookUrl });

  try {
    const tool = await createCalendarTool(webhookUrl, organizationId, apiKey);
    log.info('Calendar tool created', { toolId: tool.tool_id });

    // Save tool ID to database
    await supabase
      .from('organization_agents')
      .update({ elevenlabs_calendar_tool_id: tool.tool_id })
      .eq('organization_id', organizationId);

    return tool.tool_id;
  } catch (error) {
    log.error('Failed to create calendar tool', error as Error);
    return null;
  }
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

  // Setup calendar tool if Google Calendar is connected
  const calendarToolId = await setupCalendarTool(
    supabase,
    organizationId,
    agentRecord?.elevenlabs_calendar_tool_id || null,
    apiKey
  );

  const { prompt: systemPrompt, firstMessage } = await buildAgentPrompt(supabase, orgData, agentContext, !!calendarToolId);

  const DEFAULT_VOICE_ID = '625jGFaa0zTLtQfxwc6Q';

  let llmModel = 'gemini-2.5-flash';
  try {
    const parsed = JSON.parse(agentContext);
    if (parsed.llmModel) llmModel = parsed.llmModel;
  } catch { }

  const envPrefix = config.isLocal ? '[LOCAL]' : config.isDevelopment ? '[DEV]' : '';
  const modePrefix = '[INBOUND]';
  const agentName = `${envPrefix}${modePrefix} ${orgData.name} - ${organizationId}`;

  // Build agent config with optional calendar tool
  const agentConfig: any = {
    name: agentName,
    conversation_config: {
      agent: {
        first_message: firstMessage,
        prompt: { prompt: systemPrompt },
        llm: { model: llmModel }
      },
      tts: { voice_id: DEFAULT_VOICE_ID }
    },
    platform_settings: {
      widget: { avatar: { type: "orb" } }
    }
  };

  // Attach calendar tool if available
  if (calendarToolId) {
    agentConfig.conversation_config.agent.tools = [{ id: calendarToolId }];
    log.info('Calendar tool attached to agent', { calendarToolId });
  }

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

async function buildAgentPrompt(supabase: any, orgData: any, context: string, hasCalendarTool: boolean = false): Promise<{ prompt: string; firstMessage: string }> {
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

APPOINTMENT SCHEDULING:
You have access to the business calendar through the check_calendar_availability tool.

When a customer asks about availability or wants to schedule an appointment:
1. Ask what day/time range works best for them (today, tomorrow, this week, or next week)
2. Use the check_calendar_availability tool to find open slots
3. Present 2-3 available options to the customer
4. Confirm their selection and collect any needed information (name, phone, address, service needed)

Example: "I can check our calendar for you. Are you looking for an appointment today, tomorrow, or later this week?"

After using the tool, interpret the results naturally:
- If slots are available: "I found some openings! How about [time option 1] or [time option 2]?"
- If no slots found: "I don't see any availability for that time. Would you like me to check [alternative time]?"`;

    fullPrompt = `${fullPrompt}\n${calendarToolInstructions}`;
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

  // Setup calendar tool if Google Calendar is connected
  const calendarToolId = await setupCalendarTool(
    supabase,
    organizationId,
    agentRecord?.elevenlabs_calendar_tool_id || null,
    apiKey
  );

  const { prompt: systemPrompt, firstMessage } = await buildAgentPrompt(supabase, orgData, agentContext, !!calendarToolId);

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
        llm: { model: llmModel }
      }
    }
  };

  // Attach calendar tool if available
  if (calendarToolId) {
    updateConfig.conversation_config.agent.tools = [{ id: calendarToolId }];
    log.info('Calendar tool attached to agent update', { calendarToolId });
  }

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
