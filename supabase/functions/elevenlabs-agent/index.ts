import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient } from "../_shared/db.ts";
import { corsPreflightResponse, errorResponse, successResponse } from "../_shared/errors.ts";
import { createLogger } from "../_shared/logger.ts";
import { config } from "../_shared/config.ts";
import {
  getElevenLabsApiKey,
  getSignedUrl,
  getSignedUrlWithVariables,
  makeElevenLabsRequest,
  importPhoneNumber,
  assignAgentToPhoneNumber,
  buildLeadRecoveryWorkflow,
  buildDynamicVariablesConfig,
  type WorkflowConfig,
  type AgentWorkflow,
} from "../_shared/elevenlabs.ts";
import {
  buildPlaceholderValues,
  replacePlaceholders,
  type PlaceholderValues,
} from "../_shared/placeholder-utils.ts";

// Feature flag for workflow-based agents
const USE_WORKFLOW_AGENTS = Deno.env.get('USE_WORKFLOW_AGENTS') === 'true';

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
 * Build inline webhook tools for the agent (legacy mode)
 * These are embedded directly in the agent config, not created as separate tools
 * Institution ID is embedded via 'const' in the schema for security isolation
 *
 * NOTE: This is legacy code for non-workflow agents. Only includes contact tools.
 * For lead recovery workflow, use buildWorkflowAgentConfig instead.
 */
function buildInlineWebhookTools(accountId: string): any[] {
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
          account_id: { type: "string", const: accountId, description: "Account ID (auto-filled)" },
          phone: { type: "string", description: "Customer phone number. Required field." },
          name: { type: "string", description: "Customer full name." },
          address: { type: "string", description: "Customer address including street, city, state, and zip code." },
          email: { type: "string", description: "Customer email address." }
        },
        required: ["account_id", "phone"]
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
          account_id: { type: "string", const: accountId, description: "Account ID (auto-filled)" },
          phone: { type: "string", description: "Phone number to look up. Can be from caller ID." }
        },
        required: ["account_id", "phone"]
      }
    }
  });

  return tools;
}

/**
 * Get workflow configuration from account
 */
function getWorkflowConfig(orgData: any): WorkflowConfig {
  const workflowConfig = orgData.workflow_config || {};
  return {
    emergencyKeywords: workflowConfig.emergency_keywords || [
      'no heat', 'gas smell', 'gas leak', 'flood', 'flooding', 'fire', 'smoke',
      'carbon monoxide', 'no power', 'sparking', 'electrical fire', 'water damage',
      'burst pipe', 'sewage', 'no ac', 'no air conditioning'
    ],
    serviceCategories: workflowConfig.service_categories || ['hvac', 'plumbing', 'electrical', 'general'],
    transferEnabled: workflowConfig.transfer_enabled !== false,
    callbackHoursOffset: workflowConfig.callback_hours_offset || 2,
  };
}

/**
 * Build workflow-based agent configuration for lead recovery
 */
async function buildWorkflowAgentConfig(
  supabase: any,
  accountId: string,
  orgData: any,
  agentName: string,
  llmModel: string = 'gemini-2.5-flash'
): Promise<any> {
  const baseUrl = getWebhookBaseUrl();
  const workflowConfig = getWorkflowConfig(orgData);

  const onCallPhone = orgData.notification_phone || '';

  // Build workflow
  const workflow = buildLeadRecoveryWorkflow(accountId, baseUrl, workflowConfig);

  // Build dynamic variables configuration
  const dynamicVarsConfig = buildDynamicVariablesConfig(
    orgData.name,
    onCallPhone,
    workflowConfig.serviceCategories,
    `within ${workflowConfig.callbackHoursOffset} hours`
  );

  const DEFAULT_VOICE_ID = '625jGFaa0zTLtQfxwc6Q';

  // Build the base system prompt for lead recovery
  const systemPrompt = `You are a friendly AI intake coordinator for ${orgData.name}, a home services company.

Your primary goal is to collect information from callers and either:
1. Transfer emergencies to an on-call technician
2. Log non-emergency service requests for callback

Keep responses SHORT (1-3 sentences) - this is a phone call.
Be warm, helpful, and professional.`;

  const firstMessage = `Hi, thanks for calling ${orgData.name}! How can I help you today?`;

  return {
    name: agentName,
    conversation_config: {
      agent: {
        first_message: firstMessage,
        prompt: { prompt: systemPrompt },
        llm: { model: llmModel },
        ...dynamicVarsConfig,
      },
      tts: { voice_id: DEFAULT_VOICE_ID },
    },
    workflow: workflow,
    platform_settings: {
      widget: { avatar: { type: 'orb' } },
    },
  };
}

/**
 * Get dynamic variables for a call (for workflow agents)
 */
async function getDynamicVariablesForCall(
  supabase: any,
  accountId: string,
  callerPhone: string
): Promise<Record<string, string>> {
  // Get account
  const { data: org } = await supabase
    .from('accounts')
    .select('name, workflow_config, notification_phone')
    .eq('id', accountId)
    .single();

  const workflowConfig = org?.workflow_config || {};

  return {
    org_name: org?.name || 'Our company',
    on_call_phone: org?.notification_phone || '',
    on_call_name: 'our technician',
    caller_phone: callerPhone,
    service_categories: (workflowConfig.service_categories || ['hvac', 'plumbing', 'electrical', 'general']).join(', '),
    callback_timeframe: `within ${workflowConfig.callback_hours_offset || 2} hours`,
  };
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
        return await handleCreateAgent(supabase, body.accountId, body.context);
      }

      if (body.action === 'update-agent') {
        return await handleUpdateAgent(supabase, body.accountId, body.context, body.voiceId);
      }

      if (body.action === 'rename-agent') {
        return await handleRenameAgent(supabase, body.accountId, body.name);
      }

      if (body.action === 'import-phone') {
        return await handleImportPhone(supabase, body.accountId, body.agentId, body.phoneNumber);
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

async function handleCreateAgent(supabase: any, accountId: string, context?: string) {
  const log = logger.withContext({ accountId, action: 'create-agent' });

  let apiKey: string;
  try {
    apiKey = getElevenLabsApiKey();
  } catch (error) {
    return errorResponse('ElevenLabs API key not configured', 500);
  }

  if (!accountId) {
    return errorResponse('Account ID is required', 400);
  }

  log.step('Creating ElevenLabs agent');

  const { data: orgData, error: orgError } = await supabase
    .from('accounts')
    .select('*')
    .eq('id', accountId)
    .single();

  if (orgError) {
    log.error('Error fetching account', orgError);
    return errorResponse('Account not found', 404);
  }

  // Get or create account_agents record
  let { data: agentRecord } = await supabase
    .from('account_agents')
    .select('*')
    .eq('account_id', accountId)
    .maybeSingle();

  if (!agentRecord) {
    const { data: newRecord } = await supabase
      .from('account_agents')
      .insert({ account_id: accountId, context: context || null })
      .select()
      .single();
    agentRecord = newRecord;
  }

  const agentContext = context || agentRecord?.context || '';

  // Build inline webhook tools (contact tools only for legacy mode)
  const inlineTools = buildInlineWebhookTools(accountId);
  log.info('Built inline tools', { toolCount: inlineTools.length, toolNames: inlineTools.map((t: any) => t.name) });

  // Build prompt with tool instructions
  const { prompt: systemPrompt, firstMessage } = await buildAgentPrompt(supabase, orgData, agentContext);

  // Fetch knowledge base documents
  const kbDocs = await getKnowledgeBaseDocuments(supabase, accountId);
  log.info('Fetched KB documents', { count: kbDocs.length });

  const DEFAULT_VOICE_ID = '625jGFaa0zTLtQfxwc6Q';

  let llmModel = 'gemini-2.5-flash';
  try {
    const parsed = JSON.parse(agentContext);
    if (parsed.llmModel) llmModel = parsed.llmModel;
  } catch { }

  const envPrefix = config.isLocal ? '[LOCAL]' : config.isDevelopment ? '[DEV]' : '';
  const modePrefix = USE_WORKFLOW_AGENTS ? '[WORKFLOW]' : '[INBOUND]';
  const agentName = `${envPrefix}${modePrefix} ${orgData.name} - ${accountId}`;

  // Build agent config - use workflow or inline tools based on feature flag
  let agentConfig: any;

  if (USE_WORKFLOW_AGENTS) {
    log.info('Using workflow-based agent configuration');
    agentConfig = await buildWorkflowAgentConfig(supabase, accountId, orgData, agentName, llmModel);
  } else {
    // Legacy: Build agent config with inline tools
    const promptConfig: any = { prompt: systemPrompt };

    // Add knowledge base if there are documents
    if (kbDocs.length > 0) {
      promptConfig.knowledge_base = kbDocs.map(doc => ({
        type: 'file',
        id: doc.id,
        name: doc.name,
      }));
    }

    agentConfig = {
      name: agentName,
      conversation_config: {
        agent: {
          first_message: firstMessage,
          prompt: promptConfig,
          llm: { model: llmModel },
          tools: inlineTools  // Inline webhook tools with api_schema
        },
        tts: { voice_id: DEFAULT_VOICE_ID }
      },
      platform_settings: {
        widget: { avatar: { type: "orb" } }
      }
    };
  }

  try {
    log.info('Creating ElevenLabs agent', { useWorkflow: USE_WORKFLOW_AGENTS });

    const agentData = await makeElevenLabsRequest<{ agent_id: string }>(
      '/convai/agents/create',
      { apiKey, method: 'POST', body: agentConfig }
    );

    log.info('ElevenLabs agent created', { agentId: agentData.agent_id });

    await supabase
      .from('account_agents')
      .update({ elevenlabs_agent_id: agentData.agent_id, context: agentContext || null })
      .eq('account_id', accountId);

    // Import phone number to ElevenLabs
    try {
      await importPhoneNumberToElevenLabs(supabase, accountId, agentData.agent_id, agentName, apiKey);
    } catch (importError) {
      const err = importError as Error;
      log.error('Phone import failed', {
        error: err.message,
        stack: err.stack,
        accountId,
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
  accountId: string,
  agentId: string,
  agentLabel: string,
  apiKey: string,
  phoneNumberParam?: string  // Optional: if provided, query by phone number directly
): Promise<void> {
  console.log(`[ElevenLabs Phone Import] Starting for org: ${accountId}, agent: ${agentId}, phone: ${phoneNumberParam || 'not provided'}`);

  // Always use the org's actual subaccount credentials - this is where the phone was purchased
  const { data: orgData, error: orgError } = await supabase
    .from('accounts')
    .select('twilio_subaccount_sid, twilio_subaccount_auth_token')
    .eq('id', accountId)
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
    // Fallback: query by account_id
    console.log(`[ElevenLabs Phone Import] Querying by account_id: ${accountId}`);
    const result = await supabase
      .from('phone_numbers')
      .select('id, phone_number, elevenlabs_phone_number_id')
      .eq('account_id', accountId)
      .eq('is_active', true)
      .maybeSingle();
    phoneData = result.data;
    phoneError = result.error;
  }

  if (phoneError) {
    throw new Error(`[ElevenLabs Phone Import] Error fetching phone: ${JSON.stringify(phoneError)}`);
  }

  if (!phoneData) {
    throw new Error(`[ElevenLabs Phone Import] No phone number found - phoneNumber: ${phoneNumberParam}, orgId: ${accountId}`);
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

/**
 * Build agent prompt (legacy mode)
 * This is simplified for lead recovery - just contact tools and basic receptionist functionality
 */
async function buildAgentPrompt(supabase: any, orgData: any, context: string): Promise<{ prompt: string; firstMessage: string }> {
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

  // Build placeholder values
  const placeholderValues = buildPlaceholderValues(
    orgData,
    [],
    { context }
  );

  const basePromptTemplate = templateMap['agent_base_prompt'] || getDefaultBasePrompt();
  const firstMessageTemplate = templateMap['agent_first_message'] || 'Hello! Thanks for calling {{orgName}}. How can I help you today?';
  const contextPrefix = templateMap['agent_context_prefix'] || 'ADDITIONAL BUSINESS CONTEXT:';

  // Use shared replacePlaceholders function
  const firstMessage = greeting || replacePlaceholders(firstMessageTemplate, placeholderValues);
  let fullPrompt = replacePlaceholders(basePromptTemplate, placeholderValues);

  // Append custom instructions if provided
  if (customInstructions && customInstructions.trim()) {
    fullPrompt = `${fullPrompt}\n\n${contextPrefix}\n${customInstructions}`;
  }

  // Add contact tools instructions
  const contactToolInstructions = `

CONTACT MANAGEMENT:
You have access to contact tools to manage customer information.

Tools available:
- lookup_contact: Look up a customer by phone number to identify returning customers
- save_contact: Save or update customer contact information (name, phone, address, email)

When to use these tools:
1. At the start of a call, if you have the caller's phone number from caller ID, use lookup_contact to check if they're a returning customer
2. When a customer provides their name, phone, address, or email, use save_contact to store their information
3. Always confirm information with the customer before saving`;

  fullPrompt = `${fullPrompt}\n${contactToolInstructions}`;

  return { prompt: fullPrompt, firstMessage };
}

/**
 * Fetch knowledge base documents for an account
 */
async function getKnowledgeBaseDocuments(supabase: any, accountId: string): Promise<Array<{ id: string; name: string }>> {
  const { data: docs } = await supabase
    .from('knowledge_base_documents')
    .select('elevenlabs_document_id, name')
    .eq('account_id', accountId);

  if (!docs || docs.length === 0) {
    return [];
  }

  return docs.map((doc: { elevenlabs_document_id: string; name: string }) => ({
    id: doc.elevenlabs_document_id,
    name: doc.name,
  }));
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

async function handleUpdateAgent(supabase: any, accountId: string, context?: string, voiceId?: string) {
  const log = logger.withContext({ accountId, action: 'update-agent' });

  let apiKey: string;
  try {
    apiKey = getElevenLabsApiKey();
  } catch {
    return errorResponse('ElevenLabs API key not configured', 500);
  }

  if (!accountId) {
    return errorResponse('Account ID is required', 400);
  }

  log.step('Updating ElevenLabs agent');

  const { data: orgData } = await supabase
    .from('accounts')
    .select('*')
    .eq('id', accountId)
    .single();

  if (!orgData) {
    return errorResponse('Account not found', 404);
  }

  const { data: agentRecord } = await supabase
    .from('account_agents')
    .select('*')
    .eq('account_id', accountId)
    .maybeSingle();

  if (!agentRecord?.elevenlabs_agent_id) {
    log.info('No existing agent found, creating new one');
    return handleCreateAgent(supabase, accountId, context);
  }

  const agentContext = context || agentRecord?.context || '';

  // Build inline webhook tools (contact tools only for legacy mode)
  const inlineTools = buildInlineWebhookTools(accountId);
  log.info('Built inline tools for update', { toolCount: inlineTools.length, toolNames: inlineTools.map((t: any) => t.name) });

  // Build prompt with tool instructions
  const { prompt: systemPrompt, firstMessage } = await buildAgentPrompt(supabase, orgData, agentContext);

  // Fetch knowledge base documents
  const kbDocs = await getKnowledgeBaseDocuments(supabase, accountId);
  log.info('Fetched KB documents for update', { count: kbDocs.length });

  let llmModel = 'gemini-2.5-flash';
  try {
    const parsed = JSON.parse(agentContext);
    if (parsed.llmModel) llmModel = parsed.llmModel;
  } catch { }

  // Build update config - use workflow or inline tools based on feature flag
  let updateConfig: any;

  if (USE_WORKFLOW_AGENTS) {
    log.info('Using workflow-based agent configuration for update');
    const envPrefix = config.isLocal ? '[LOCAL]' : config.isDevelopment ? '[DEV]' : '';
    const modePrefix = '[WORKFLOW]';
    const agentName = `${envPrefix}${modePrefix} ${orgData.name} - ${accountId}`;
    updateConfig = await buildWorkflowAgentConfig(supabase, accountId, orgData, agentName, llmModel);
  } else {
    // Legacy: Build update config with inline tools
    const promptConfig: any = { prompt: systemPrompt };

    // Add knowledge base if there are documents
    if (kbDocs.length > 0) {
      promptConfig.knowledge_base = kbDocs.map(doc => ({
        type: 'file',
        id: doc.id,
        name: doc.name,
      }));
    }

    updateConfig = {
      conversation_config: {
        agent: {
          first_message: firstMessage,
          prompt: promptConfig,
          llm: { model: llmModel },
          tools: inlineTools  // Inline webhook tools with api_schema
        }
      }
    };
  }

  if (voiceId) {
    updateConfig.conversation_config = updateConfig.conversation_config || {};
    updateConfig.conversation_config.tts = { voice_id: voiceId };
    log.info('Setting voice ID', { voiceId });
  }

  try {
    await makeElevenLabsRequest(
      `/convai/agents/${agentRecord.elevenlabs_agent_id}`,
      { apiKey, method: 'PATCH', body: updateConfig }
    );

    log.info('ElevenLabs agent updated', { useWorkflow: USE_WORKFLOW_AGENTS });

    await supabase
      .from('account_agents')
      .update({ context: agentContext || null })
      .eq('account_id', accountId);

    // Import phone number if not already imported (ensures phone is linked to agent)
    const envPrefix = config.isLocal ? '[LOCAL]' : config.isDevelopment ? '[DEV]' : '';
    const modePrefix = '[INBOUND]';
    const agentLabel = `${envPrefix}${modePrefix} ${orgData.name} - ${accountId}`;

    try {
      await importPhoneNumberToElevenLabs(supabase, accountId, agentRecord.elevenlabs_agent_id, agentLabel, apiKey);
      log.info('Phone import completed during update');
    } catch (importError) {
      const err = importError as Error;
      log.error('Phone import failed during update', {
        error: err.message,
        stack: err.stack,
        accountId,
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

async function handleRenameAgent(supabase: any, accountId: string, name: string) {
  const log = logger.withContext({ accountId, action: 'rename-agent' });

  let apiKey: string;
  try {
    apiKey = getElevenLabsApiKey();
  } catch {
    return errorResponse('ElevenLabs API key not configured', 500);
  }

  if (!accountId || !name) {
    return errorResponse('Account ID and name are required', 400);
  }

  log.step('Renaming ElevenLabs agent', { newName: name });

  const { data: agentRecord } = await supabase
    .from('account_agents')
    .select('elevenlabs_agent_id')
    .eq('account_id', accountId)
    .maybeSingle();

  if (!agentRecord?.elevenlabs_agent_id) {
    return successResponse({ success: true, message: 'No agent exists to rename' });
  }

  const envPrefix = config.isLocal ? '[LOCAL]' : config.isDevelopment ? '[DEV]' : '';
  const modePrefix = '[INBOUND]';
  const agentName = `${envPrefix}${modePrefix} ${name} - ${accountId}`;

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

async function handleImportPhone(supabase: any, accountId: string, agentId: string, phoneNumber?: string) {
  const log = logger.withContext({ accountId, agentId, phoneNumber, action: 'import-phone' });

  let apiKey: string;
  try {
    apiKey = getElevenLabsApiKey();
  } catch {
    return errorResponse('ElevenLabs API key not configured', 500);
  }

  if (!accountId || !agentId) {
    return errorResponse('Account ID and Agent ID are required', 400);
  }

  log.step('Importing phone to ElevenLabs', { phoneNumber });

  // Get org name for label
  const { data: orgData } = await supabase
    .from('accounts')
    .select('name')
    .eq('id', accountId)
    .single();

  const envPrefix = config.isLocal ? '[LOCAL]' : config.isDevelopment ? '[DEV]' : '';
  const modePrefix = '[INBOUND]';
  const agentLabel = `${envPrefix}${modePrefix} ${orgData?.name || 'Unknown'} - ${accountId}`;

  try {
    await importPhoneNumberToElevenLabs(supabase, accountId, agentId, agentLabel, apiKey, phoneNumber);

    // Get the phone number ID that was just imported
    const { data: phoneData } = await supabase
      .from('phone_numbers')
      .select('elevenlabs_phone_number_id')
      .eq('account_id', accountId)
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
