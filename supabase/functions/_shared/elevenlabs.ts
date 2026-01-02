/**
 * ElevenLabs utility functions
 * Provides common ElevenLabs Conversational AI operations and helpers
 */

import { EdgeFunctionError } from './types.ts';

export const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io/v1';

export interface ElevenLabsConfig {
  apiKey: string;
}

export interface ElevenLabsAgent {
  agent_id: string;
  name?: string;
}

export interface ElevenLabsPhoneNumber {
  phone_number_id: string;
  phone_number: string;
  label?: string;
  agent_id?: string;
}

export interface AgentConversationConfig {
  firstMessage: string;
  systemPrompt: string;
  voiceId?: string;
  llmModel?: string;
}

// ============================================
// WORKFLOW TYPES
// ============================================

export interface WorkflowConfig {
  emergencyKeywords: string[];
  serviceCategories: string[];
  transferEnabled: boolean;
  callbackHoursOffset?: number;
}

export interface WorkflowNode {
  id: string;
  type: 'conversation' | 'tool' | 'transfer_call' | 'end_call' | 'webhook';
  data: Record<string, any>;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  data?: {
    condition?: {
      type: 'prompt' | 'tool_result' | 'always';
      description?: string;
    };
  };
}

export interface AgentWorkflow {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface DynamicVariableConfig {
  dynamic_variable_placeholders: Record<string, {
    type: string;
    default?: string;
    description?: string;
  }>;
}

/**
 * Get ElevenLabs API key from environment
 */
export function getElevenLabsApiKey(): string {
  const apiKey = Deno.env.get('ELEVENLABS_API_KEY');

  if (!apiKey) {
    throw new EdgeFunctionError(
      'ElevenLabs API key not configured',
      'CONFIG_ERROR',
      500
    );
  }

  return apiKey;
}

/**
 * Make an authenticated request to ElevenLabs API
 */
export async function makeElevenLabsRequest<T = any>(
  endpoint: string,
  options: {
    apiKey: string;
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    body?: Record<string, any>;
  }
): Promise<T> {
  const { apiKey, method = 'GET', body } = options;
  const url = endpoint.startsWith('http') ? endpoint : `${ELEVENLABS_API_BASE}${endpoint}`;

  const headers: HeadersInit = {
    'xi-api-key': apiKey,
  };

  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // Handle DELETE responses (typically empty)
  if (method === 'DELETE') {
    if (!response.ok && response.status !== 404) {
      const errorText = await response.text();
      throw new EdgeFunctionError(
        `ElevenLabs API error: ${errorText}`,
        'ELEVENLABS_API_ERROR',
        response.status,
        { endpoint, status: response.status }
      );
    }
    return {} as T;
  }

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `ElevenLabs API error (${response.status})`;

    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.detail?.message || errorJson.detail || errorJson.error || errorMessage;
    } catch {
      errorMessage = errorText || errorMessage;
    }

    throw new EdgeFunctionError(
      errorMessage,
      'ELEVENLABS_API_ERROR',
      response.status,
      { endpoint, status: response.status }
    );
  }

  const text = await response.text();
  if (!text) {
    return {} as T;
  }

  return JSON.parse(text);
}

/**
 * Get signed URL for WebSocket connection to agent
 */
export async function getSignedUrl(
  agentId: string,
  apiKey: string
): Promise<string> {
  const result = await makeElevenLabsRequest<{ signed_url: string }>(
    `/convai/conversation/get_signed_url?agent_id=${agentId}`,
    { apiKey }
  );

  return result.signed_url;
}

/**
 * Create an ElevenLabs conversational AI agent
 */
export async function createAgent(
  name: string,
  config: AgentConversationConfig,
  apiKey: string
): Promise<ElevenLabsAgent> {
  const agentConfig = {
    name,
    conversation_config: {
      agent: {
        first_message: config.firstMessage,
        prompt: {
          prompt: config.systemPrompt,
        },
        llm: {
          model: config.llmModel || 'gemini-2.5-flash',
        },
      },
      tts: {
        voice_id: config.voiceId || '625jGFaa0zTLtQfxwc6Q', // Default: Veda Sky
      },
    },
    platform_settings: {
      widget: {
        avatar: {
          type: 'orb',
        },
      },
    },
  };

  return makeElevenLabsRequest<ElevenLabsAgent>(
    '/convai/agents/create',
    {
      apiKey,
      method: 'POST',
      body: agentConfig,
    }
  );
}

/**
 * Update an existing ElevenLabs agent
 */
export async function updateAgent(
  agentId: string,
  updates: {
    name?: string;
    firstMessage?: string;
    systemPrompt?: string;
    voiceId?: string;
    llmModel?: string;
  },
  apiKey: string
): Promise<ElevenLabsAgent> {
  const updateConfig: any = {};

  if (updates.name) {
    updateConfig.name = updates.name;
  }

  if (updates.firstMessage || updates.systemPrompt || updates.llmModel) {
    updateConfig.conversation_config = {
      agent: {},
    };

    if (updates.firstMessage) {
      updateConfig.conversation_config.agent.first_message = updates.firstMessage;
    }

    if (updates.systemPrompt) {
      updateConfig.conversation_config.agent.prompt = {
        prompt: updates.systemPrompt,
      };
    }

    if (updates.llmModel) {
      updateConfig.conversation_config.agent.llm = {
        model: updates.llmModel,
      };
    }
  }

  if (updates.voiceId) {
    updateConfig.conversation_config = updateConfig.conversation_config || {};
    updateConfig.conversation_config.tts = {
      voice_id: updates.voiceId,
    };
  }

  return makeElevenLabsRequest<ElevenLabsAgent>(
    `/convai/agents/${agentId}`,
    {
      apiKey,
      method: 'PATCH',
      body: updateConfig,
    }
  );
}

/**
 * Delete an ElevenLabs agent
 */
export async function deleteAgent(
  agentId: string,
  apiKey: string
): Promise<void> {
  await makeElevenLabsRequest(
    `/convai/agents/${agentId}`,
    {
      apiKey,
      method: 'DELETE',
    }
  );
}

/**
 * List agents
 */
export async function listAgents(
  apiKey: string
): Promise<ElevenLabsAgent[]> {
  const result = await makeElevenLabsRequest<{ agents: ElevenLabsAgent[] }>(
    '/convai/agents',
    { apiKey }
  );

  return result.agents || [];
}

/**
 * Import a phone number to ElevenLabs
 */
export async function importPhoneNumber(
  phoneNumber: string,
  label: string,
  twilioSid: string,
  twilioToken: string,
  apiKey: string
): Promise<ElevenLabsPhoneNumber> {
  const payload = {
    phone_number: phoneNumber,
    label,
    provider: 'twilio',
    sid: twilioSid,
    token: twilioToken,
  };

  return makeElevenLabsRequest<ElevenLabsPhoneNumber>(
    '/convai/phone-numbers',
    {
      apiKey,
      method: 'POST',
      body: payload,
    }
  );
}

/**
 * Assign an agent to a phone number
 */
export async function assignAgentToPhoneNumber(
  phoneNumberId: string,
  agentId: string,
  apiKey: string
): Promise<void> {
  await makeElevenLabsRequest(
    `/convai/phone-numbers/${phoneNumberId}`,
    {
      apiKey,
      method: 'PATCH',
      body: { agent_id: agentId },
    }
  );
}

/**
 * Delete a phone number from ElevenLabs
 */
export async function deletePhoneNumber(
  phoneNumberId: string,
  apiKey: string
): Promise<void> {
  await makeElevenLabsRequest(
    `/convai/phone-numbers/${phoneNumberId}`,
    {
      apiKey,
      method: 'DELETE',
    }
  );
}

/**
 * List phone numbers
 */
export async function listPhoneNumbers(
  apiKey: string
): Promise<ElevenLabsPhoneNumber[]> {
  const result = await makeElevenLabsRequest<{ phone_numbers: ElevenLabsPhoneNumber[] }>(
    '/convai/phone-numbers',
    { apiKey }
  );

  return result.phone_numbers || [];
}

/**
 * Get conversations for an agent
 */
export async function getConversations(
  agentId: string,
  apiKey: string,
  limit: number = 100
): Promise<any[]> {
  const result = await makeElevenLabsRequest<{ conversations: any[] }>(
    `/convai/agents/${agentId}/conversations?page_size=${limit}`,
    { apiKey }
  );

  return result.conversations || [];
}

/**
 * Get a specific conversation
 */
export async function getConversation(
  conversationId: string,
  apiKey: string
): Promise<any> {
  return makeElevenLabsRequest(
    `/convai/conversations/${conversationId}`,
    { apiKey }
  );
}

/**
 * Generate voice previews using TTS
 */
export async function generateVoicePreview(
  text: string,
  voiceId: string,
  apiKey: string
): Promise<ArrayBuffer> {
  const url = `${ELEVENLABS_API_BASE}/text-to-speech/${voiceId}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_turbo_v2_5',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new EdgeFunctionError(
      `Failed to generate voice preview: ${errorText}`,
      'ELEVENLABS_API_ERROR',
      response.status
    );
  }

  return response.arrayBuffer();
}

/**
 * Tool configuration interface
 */
export interface ElevenLabsTool {
  tool_id: string;
  name: string;
  type: string;
}

/**
 * Create a calendar availability tool for an agent
 * This tool allows the agent to check Google Calendar for available appointment slots
 */
export async function createCalendarTool(
  webhookUrl: string,
  institutionId: string,
  apiKey: string
): Promise<ElevenLabsTool> {
  const toolConfig = {
    type: 'webhook',
    name: 'check_calendar_availability',
    description: 'Check the business calendar to find available appointment slots. Use this tool when a customer wants to schedule an appointment or asks about availability. The tool will return available time slots based on the business calendar and existing appointments.',
    webhook: {
      url: webhookUrl,
      method: 'POST',
      request_headers: {
        'Content-Type': 'application/json',
      },
      request_body: {
        institution_id: institutionId,
      },
    },
    parameters: {
      type: 'object',
      properties: {
        date_preference: {
          type: 'string',
          description: "When the customer wants the appointment. Use 'today' for same-day, 'tomorrow' for next day, 'this_week' for current week, or 'next_week' for looking further ahead. Default to 'this_week' if customer doesn't specify.",
          enum: ['today', 'tomorrow', 'this_week', 'next_week'],
        },
        duration_minutes: {
          type: 'number',
          description: 'How long the appointment should be in minutes. Use 60 for standard appointments, 30 for quick consultations.',
          default: 60,
        },
      },
      required: ['date_preference'],
    },
  };

  const result = await makeElevenLabsRequest<{ tool_id: string; name: string; type: string }>(
    '/convai/tools',
    {
      apiKey,
      method: 'POST',
      body: { tool_config: toolConfig },
    }
  );

  return {
    tool_id: result.tool_id,
    name: result.name || 'check_calendar_availability',
    type: result.type || 'webhook',
  };
}

/**
 * Get a tool by ID
 */
export async function getTool(
  toolId: string,
  apiKey: string
): Promise<ElevenLabsTool | null> {
  try {
    const result = await makeElevenLabsRequest<ElevenLabsTool>(
      `/convai/tools/${toolId}`,
      { apiKey }
    );
    return result;
  } catch (error) {
    return null;
  }
}

/**
 * Delete a tool
 */
export async function deleteTool(
  toolId: string,
  apiKey: string
): Promise<void> {
  await makeElevenLabsRequest(
    `/convai/tools/${toolId}`,
    {
      apiKey,
      method: 'DELETE',
    }
  );
}

/**
 * List all tools
 */
export async function listTools(
  apiKey: string
): Promise<ElevenLabsTool[]> {
  const result = await makeElevenLabsRequest<{ tools: ElevenLabsTool[] }>(
    '/convai/tools',
    { apiKey }
  );

  return result.tools || [];
}

/**
 * Create a save contact tool for an agent
 * Allows the agent to save customer contact information during live calls
 * Organization ID is baked into the webhook for security isolation
 */
export async function createSaveContactTool(
  webhookUrl: string,
  institutionId: string,
  apiKey: string
): Promise<ElevenLabsTool> {
  const toolConfig = {
    type: 'webhook',
    name: 'save_contact',
    description: 'Save or update customer contact information in the database. Use this tool when the customer provides their name, phone number, address, or email. Always confirm the information with the customer before saving.',
    webhook: {
      url: webhookUrl,
      method: 'POST',
      request_headers: {
        'Content-Type': 'application/json',
      },
      request_body: {
        institution_id: institutionId,
      },
    },
    parameters: {
      type: 'object',
      properties: {
        phone: {
          type: 'string',
          description: 'Customer phone number. Required field.',
        },
        name: {
          type: 'string',
          description: 'Customer full name.',
        },
        address: {
          type: 'string',
          description: 'Customer address including street, city, state, and zip code.',
        },
        email: {
          type: 'string',
          description: 'Customer email address.',
        },
      },
      required: ['phone'],
    },
  };

  const result = await makeElevenLabsRequest<{ tool_id: string; name: string; type: string }>(
    '/convai/tools',
    {
      apiKey,
      method: 'POST',
      body: { tool_config: toolConfig },
    }
  );

  return {
    tool_id: result.tool_id,
    name: result.name || 'save_contact',
    type: result.type || 'webhook',
  };
}

/**
 * Create a lookup contact tool for an agent
 * Allows the agent to identify returning customers by phone number
 * Organization ID is baked into the webhook for security isolation
 */
export async function createLookupContactTool(
  webhookUrl: string,
  institutionId: string,
  apiKey: string
): Promise<ElevenLabsTool> {
  const toolConfig = {
    type: 'webhook',
    name: 'lookup_contact',
    description: 'Look up a customer by their phone number to check if they are a returning customer. Use this at the start of a call if you have the caller\'s phone number from caller ID. This helps provide personalized service to returning customers.',
    webhook: {
      url: webhookUrl,
      method: 'POST',
      request_headers: {
        'Content-Type': 'application/json',
      },
      request_body: {
        institution_id: institutionId,
      },
    },
    parameters: {
      type: 'object',
      properties: {
        phone: {
          type: 'string',
          description: 'Phone number to look up. Can be from caller ID.',
        },
      },
      required: ['phone'],
    },
  };

  const result = await makeElevenLabsRequest<{ tool_id: string; name: string; type: string }>(
    '/convai/tools',
    {
      apiKey,
      method: 'POST',
      body: { tool_config: toolConfig },
    }
  );

  return {
    tool_id: result.tool_id,
    name: result.name || 'lookup_contact',
    type: result.type || 'webhook',
  };
}

// ============================================
// WORKFLOW HELPERS
// ============================================

/**
 * Get signed URL for WebSocket connection with dynamic variables
 * Dynamic variables are passed via the signed URL for workflow personalization
 */
export async function getSignedUrlWithVariables(
  agentId: string,
  apiKey: string,
  dynamicVariables?: Record<string, string>
): Promise<string> {
  const result = await makeElevenLabsRequest<{ signed_url: string }>(
    `/convai/conversation/get_signed_url?agent_id=${agentId}`,
    { apiKey }
  );

  // Append dynamic variables as query parameters if provided
  if (dynamicVariables && Object.keys(dynamicVariables).length > 0) {
    const url = new URL(result.signed_url);
    for (const [key, value] of Object.entries(dynamicVariables)) {
      if (value) {
        url.searchParams.set(key, value);
      }
    }
    return url.toString();
  }

  return result.signed_url;
}

/**
 * Build lead recovery workflow configuration
 * Creates a workflow with intake → emergency detection → transfer/callback flow
 */
export function buildLeadRecoveryWorkflow(
  institutionId: string,
  webhookBaseUrl: string,
  config: WorkflowConfig
): AgentWorkflow {
  const emergencyKeywordsDesc = config.emergencyKeywords.join(', ');

  const nodes: WorkflowNode[] = [
    // Start node - Intake conversation
    {
      id: 'intake',
      type: 'conversation',
      data: {
        name: 'Lead Intake',
        system_prompt: buildIntakePrompt(config),
        collect_fields: ['caller_name', 'caller_phone', 'service_category', 'issue_description', 'urgency'],
      },
    },
    // Log intake tool call
    {
      id: 'log_intake',
      type: 'webhook',
      data: {
        name: 'Log Intake',
        url: `${webhookBaseUrl}/functions/v1/agent-log-intake`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body_schema: {
          type: 'object',
          properties: {
            institution_id: { type: 'string', const: institutionId },
            caller_name: { type: 'string', description: 'Caller name from conversation' },
            caller_phone: { type: 'string', description: 'Caller phone number' },
            caller_address: { type: 'string', description: 'Caller address if provided' },
            service_category: {
              type: 'string',
              enum: config.serviceCategories,
              description: 'Type of service needed'
            },
            issue_description: { type: 'string', description: 'Description of the issue' },
            urgency: {
              type: 'string',
              enum: ['low', 'normal', 'high', 'emergency'],
              description: 'Urgency level'
            },
            is_emergency: { type: 'boolean', description: 'Whether this is an emergency' },
          },
          required: ['institution_id', 'caller_phone', 'issue_description'],
        },
      },
    },
    // Transfer call for emergencies
    {
      id: 'emergency_transfer',
      type: 'transfer_call',
      data: {
        name: 'Emergency Transfer',
        transfer_to: '{{on_call_phone}}',
        message_before_transfer: "I understand this is urgent. Let me connect you to our on-call technician right now. Please stay on the line.",
      },
    },
    // Callback confirmation for non-emergencies
    {
      id: 'confirm_callback',
      type: 'conversation',
      data: {
        name: 'Confirm Callback',
        system_prompt: `Confirm the callback details with the caller.
Let them know a technician will call them back within ${config.callbackHoursOffset || 2} hours.
Ask if there's anything else they need.
Keep it brief and professional.`,
      },
    },
    // End call node
    {
      id: 'end_call',
      type: 'end_call',
      data: {
        name: 'End Call',
        message: "Thank you for calling {{org_name}}. Someone will be in touch shortly. Have a great day!",
      },
    },
  ];

  const edges: WorkflowEdge[] = [
    // Intake → Emergency Transfer (if emergency detected)
    {
      id: 'intake_to_emergency',
      source: 'intake',
      target: 'emergency_transfer',
      data: {
        condition: {
          type: 'prompt',
          description: `The caller describes an emergency situation. Emergency indicators include: ${emergencyKeywordsDesc}. Also consider: immediate safety risk, flooding in progress, fire or smoke, gas smell, complete loss of heating in freezing weather, or carbon monoxide alarm.`,
        },
      },
    },
    // Intake → Log Intake (non-emergency, has enough info)
    {
      id: 'intake_to_log',
      source: 'intake',
      target: 'log_intake',
      data: {
        condition: {
          type: 'prompt',
          description: 'The caller has provided enough information (at minimum: their phone number and description of what they need help with) and it is NOT an emergency situation.',
        },
      },
    },
    // Log Intake → Confirm Callback (on success)
    {
      id: 'log_to_confirm',
      source: 'log_intake',
      target: 'confirm_callback',
      data: {
        condition: {
          type: 'tool_result',
          description: 'Intake was logged successfully',
        },
      },
    },
    // Log Intake → End Call (on failure)
    {
      id: 'log_to_end',
      source: 'log_intake',
      target: 'end_call',
      data: {
        condition: {
          type: 'tool_result',
          description: 'Intake logging failed',
        },
      },
    },
    // Confirm Callback → End Call
    {
      id: 'confirm_to_end',
      source: 'confirm_callback',
      target: 'end_call',
      data: {
        condition: {
          type: 'always',
        },
      },
    },
    // Emergency Transfer → End Call (after transfer completes or fails)
    {
      id: 'transfer_to_end',
      source: 'emergency_transfer',
      target: 'end_call',
      data: {
        condition: {
          type: 'always',
        },
      },
    },
  ];

  return { nodes, edges };
}

/**
 * Build the intake subagent prompt for lead recovery
 */
function buildIntakePrompt(config: WorkflowConfig): string {
  const categories = config.serviceCategories.join(', ');
  const emergencyKeywords = config.emergencyKeywords.join(', ');

  return `You are a friendly intake coordinator for {{org_name}}, a home services company.

Your job is to collect information from callers about their service needs. Keep responses SHORT and conversational - this is a phone call.

INFORMATION TO COLLECT:
1. Caller's name
2. Phone number (to call back)
3. Service category: ${categories}
4. Description of the issue
5. Address (if relevant)
6. Urgency level

CONVERSATION FLOW:
- Greet warmly: "Hi, thanks for calling {{org_name}}! How can I help you today?"
- Listen to their issue and categorize it
- Collect missing information naturally (don't interrogate)
- Confirm phone number for callback

EMERGENCY DETECTION:
Watch for these emergency keywords: ${emergencyKeywords}
Also consider emergencies:
- No heat when it's freezing
- Gas smell or leak
- Active flooding or water damage
- Electrical sparks or burning smell
- Carbon monoxide alarm
- Sewage backup

If you detect an emergency, acknowledge the urgency immediately:
"That sounds urgent - let me get you connected to our on-call technician right away."

NON-EMERGENCY FLOW:
For normal service calls:
- Collect their info
- Confirm what they need
- Let them know a technician will call back
- Be helpful and reassuring

IMPORTANT:
- Keep responses to 1-3 sentences
- Don't ask for all info at once
- Be warm and professional
- Caller's phone may come from caller ID ({{caller_phone}})`;
}

/**
 * Build dynamic variable configuration for lead recovery workflow
 */
export function buildDynamicVariablesConfig(
  orgName: string,
  onCallPhone: string,
  serviceCategories: string[],
  callbackTimeframe: string = 'within 2 hours'
): DynamicVariableConfig {
  return {
    dynamic_variable_placeholders: {
      org_name: {
        type: 'string',
        default: orgName,
        description: 'Name of the business',
      },
      on_call_phone: {
        type: 'string',
        default: onCallPhone,
        description: 'Phone number for emergency transfers',
      },
      caller_phone: {
        type: 'string',
        default: '',
        description: 'Caller phone from Twilio (system variable)',
      },
      service_categories: {
        type: 'string',
        default: serviceCategories.join(', '),
        description: 'Available service categories',
      },
      callback_timeframe: {
        type: 'string',
        default: callbackTimeframe,
        description: 'Expected callback timeframe for non-emergencies',
      },
    },
  };
}
