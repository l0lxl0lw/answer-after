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
