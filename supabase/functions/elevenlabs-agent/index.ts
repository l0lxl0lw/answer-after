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

const logger = createLogger('elevenlabs-agent');

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
  const { prompt: systemPrompt, firstMessage } = await buildAgentPrompt(supabase, orgData, agentContext);

  const DEFAULT_VOICE_ID = '625jGFaa0zTLtQfxwc6Q';

  let llmModel = 'gemini-2.5-flash';
  try {
    const parsed = JSON.parse(agentContext);
    if (parsed.llmModel) llmModel = parsed.llmModel;
  } catch { }

  const envPrefix = config.isLocal ? '[LOCAL]' : config.isDevelopment ? '[DEV]' : '';
  const modePrefix = '[INBOUND]';
  const agentName = `${envPrefix}${modePrefix} ${orgData.name} - ${organizationId}`;

  const agentConfig = {
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
      log.warn('Phone import failed', { error: (importError as Error).message });
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
  apiKey: string
): Promise<void> {
  console.log(`[ElevenLabs Phone Import] Starting for org: ${organizationId}, agent: ${agentId}`);

  const USE_LOCAL_SUBACCOUNT = Deno.env.get('USE_LOCAL_SUBACCOUNT') === 'true';
  const LOCAL_SUBACCOUNT_SID = Deno.env.get('LOCAL_SUBACCOUNT_SID');
  const LOCAL_SUBACCOUNT_AUTH_TOKEN = Deno.env.get('LOCAL_SUBACCOUNT_AUTH_TOKEN');

  let twilioSid: string | undefined;
  let twilioToken: string | undefined;

  if (USE_LOCAL_SUBACCOUNT || config.isLocal) {
    twilioSid = LOCAL_SUBACCOUNT_SID;
    twilioToken = LOCAL_SUBACCOUNT_AUTH_TOKEN;
  } else {
    const { data: orgData } = await supabase
      .from('organizations')
      .select('twilio_subaccount_sid, twilio_subaccount_auth_token')
      .eq('id', organizationId)
      .single();

    twilioSid = orgData?.twilio_subaccount_sid;
    twilioToken = orgData?.twilio_subaccount_auth_token;
  }

  if (!twilioSid || !twilioToken) {
    console.log('[ElevenLabs Phone Import] No Twilio credentials available');
    return;
  }

  const { data: phoneData } = await supabase
    .from('phone_numbers')
    .select('id, phone_number, elevenlabs_phone_number_id')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .maybeSingle();

  if (!phoneData) {
    console.log('[ElevenLabs Phone Import] No phone number found');
    return;
  }

  // If already imported, just assign agent
  if (phoneData.elevenlabs_phone_number_id) {
    console.log('[ElevenLabs Phone Import] Phone already imported, assigning agent');
    await assignAgentToPhoneNumber(phoneData.elevenlabs_phone_number_id, agentId, apiKey);
    return;
  }

  // Import phone number
  const importResult = await importPhoneNumber(
    phoneData.phone_number,
    agentLabel,
    twilioSid,
    twilioToken,
    apiKey
  );

  // Save phone number ID
  await supabase
    .from('phone_numbers')
    .update({ elevenlabs_phone_number_id: importResult.phone_number_id })
    .eq('id', phoneData.id);

  // Assign agent
  await assignAgentToPhoneNumber(importResult.phone_number_id, agentId, apiKey);
  console.log('[ElevenLabs Phone Import] Successfully imported phone and assigned agent');
}

async function buildAgentPrompt(supabase: any, orgData: any, context: string): Promise<{ prompt: string; firstMessage: string }> {
  let greeting = '';
  let content = '';

  try {
    const parsed = JSON.parse(context);
    greeting = parsed.greeting || '';
    content = parsed.content || '';
  } catch {
    content = context;
  }

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

  const basePromptTemplate = templateMap['agent_base_prompt'] || getDefaultBasePrompt();
  const firstMessageTemplate = templateMap['agent_first_message'] || 'Hello! Thanks for calling {{orgName}}. How can I help you today?';
  const contextPrefix = templateMap['agent_context_prefix'] || 'ADDITIONAL BUSINESS CONTEXT:';

  const replacePlaceholders = (template: string): string => {
    return template
      .replace(/\{\{orgName\}\}/g, orgData.name)
      .replace(/\{\{businessHoursStart\}\}/g, orgData.business_hours_start || '8:00 AM')
      .replace(/\{\{businessHoursEnd\}\}/g, orgData.business_hours_end || '5:00 PM');
  };

  const firstMessage = greeting || replacePlaceholders(firstMessageTemplate);
  let fullPrompt = replacePlaceholders(basePromptTemplate);

  if (content && content.trim()) {
    fullPrompt = `${fullPrompt}\n\n${contextPrefix}\n${content}`;
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

If the caller describes an emergency (gas leak, flooding, no heat in freezing weather, no cooling in extreme heat), acknowledge the urgency and assure them help is on the way.

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
  const { prompt: systemPrompt, firstMessage } = await buildAgentPrompt(supabase, orgData, agentContext);

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
