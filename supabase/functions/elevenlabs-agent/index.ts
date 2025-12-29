import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { config } from "../_shared/config.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    console.log('ElevenLabs Agent handler:', req.method, url.pathname);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Handle POST requests for agent creation
    if (req.method === 'POST') {
      const body = await req.json();
      
      // Handle action-based routing
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

    return new Response('Not found', { status: 404 });

  } catch (error) {
    console.error('Error in elevenlabs-agent function:', error);
    return new Response('Internal server error', { 
      status: 500,
      headers: corsHeaders 
    });
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

  const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
  if (!ELEVENLABS_API_KEY) {
    console.error('ELEVENLABS_API_KEY not configured');
    twilioWs.close(1000, 'API key not configured');
    return response;
  }

  let elevenLabsWs: WebSocket | null = null;
  let streamSid: string | null = null;

  // Get signed URL from ElevenLabs
  async function connectToElevenLabs() {
    try {
      console.log('Getting ElevenLabs signed URL...');
      const signedUrlResponse = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${agentId}`,
        {
          headers: { 'xi-api-key': ELEVENLABS_API_KEY! },
        }
      );

      if (!signedUrlResponse.ok) {
        const error = await signedUrlResponse.text();
        console.error('Failed to get signed URL:', error);
        return;
      }

      const { signed_url } = await signedUrlResponse.json();
      console.log('Got signed URL, connecting to ElevenLabs...');
      
      elevenLabsWs = new WebSocket(signed_url);

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
        // Send audio back to Twilio
        if (streamSid && twilioWs.readyState === WebSocket.OPEN) {
          const audioChunk = message.audio?.chunk || message.audio_event?.audio_base_64;
          if (audioChunk) {
            const twilioMessage = {
              event: 'media',
              streamSid: streamSid,
              media: {
                payload: audioChunk
              }
            };
            twilioWs.send(JSON.stringify(twilioMessage));
          }
        }
        break;
        
      case 'interruption':
        // Clear Twilio audio buffer on interruption
        if (streamSid && twilioWs.readyState === WebSocket.OPEN) {
          twilioWs.send(JSON.stringify({ event: 'clear', streamSid }));
        }
        break;
        
      case 'ping':
        // Respond to ping with pong
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
          
          // Connect to ElevenLabs when Twilio stream starts
          await connectToElevenLabs();
          
          // Update call status
          if (callSid) {
            await supabase
              .from('calls')
              .update({ status: 'active' })
              .eq('twilio_call_sid', callSid);
          }
          break;
          
        case 'media':
          // Forward audio from Twilio to ElevenLabs
          if (elevenLabsWs?.readyState === WebSocket.OPEN) {
            const audioMessage = {
              user_audio_chunk: message.media.payload
            };
            elevenLabsWs.send(JSON.stringify(audioMessage));
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

async function handleCreateAgent(
  supabase: any,
  organizationId: string,
  context?: string
) {
  const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
  
  if (!ELEVENLABS_API_KEY) {
    return new Response(JSON.stringify({ error: 'ElevenLabs API key not configured' }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  if (!organizationId) {
    return new Response(JSON.stringify({ error: 'Organization ID is required' }), { 
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  console.log(`Creating ElevenLabs agent for organization: ${organizationId}`);

  // Get organization details for agent customization
  const { data: orgData, error: orgError } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', organizationId)
    .single();

  if (orgError) {
    console.error('Error fetching organization:', orgError);
    return new Response(JSON.stringify({ error: 'Organization not found' }), { 
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
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

  // Default voice is Veda Sky (625jGFaa0zTLtQfxwc6Q)
  const DEFAULT_VOICE_ID = '625jGFaa0zTLtQfxwc6Q';
  
  // Get LLM model from agent context or use default
  let llmModel = 'gemini-2.5-flash';
  try {
    const parsed = JSON.parse(agentContext);
    if (parsed.llmModel) {
      llmModel = parsed.llmModel;
    }
  } catch {
    // Use default model
  }

  // Build agent name with environment and mode prefix
  // Format: [LOCAL][INBOUND] name - uuid
  const envPrefix = config.isLocal ? '[LOCAL]' : config.isDevelopment ? '[DEV]' : '';
  const modePrefix = '[INBOUND]'; // TODO: Pass mode from dashboard when outbound is supported
  const agentName = `${envPrefix}${modePrefix} ${orgData.name} - ${organizationId}`;

  const agentConfig = {
    name: agentName,
    conversation_config: {
      agent: {
        first_message: firstMessage,
        prompt: {
          prompt: systemPrompt
        },
        llm: {
          model: llmModel
        }
      },
      tts: {
        voice_id: DEFAULT_VOICE_ID
      }
    },
    platform_settings: {
      widget: {
        avatar: {
          type: "orb"
        }
      }
    }
  };

  try {
    console.log('Creating ElevenLabs agent with config:', JSON.stringify(agentConfig, null, 2));

    const response = await fetch('https://api.elevenlabs.io/v1/convai/agents/create', {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(agentConfig),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs agent creation error:', response.status, errorText);
      return new Response(JSON.stringify({ error: `Failed to create agent: ${errorText}` }), { 
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const agentData = await response.json();
    console.log('ElevenLabs agent created:', agentData);

    await supabase
      .from('organization_agents')
      .update({
        elevenlabs_agent_id: agentData.agent_id,
        context: agentContext || null
      })
      .eq('organization_id', organizationId);

    // Import phone number to ElevenLabs and assign the agent
    console.log('=== STARTING PHONE IMPORT ===');
    console.log('organizationId:', organizationId);
    console.log('agentId:', agentData.agent_id);
    console.log('agentName:', agentName);
    console.log('hasApiKey:', !!ELEVENLABS_API_KEY);

    try {
      await importPhoneNumberToElevenLabs(supabase, organizationId, agentData.agent_id, agentName, ELEVENLABS_API_KEY);
      console.log('=== PHONE IMPORT COMPLETED ===');
    } catch (importError) {
      console.error('=== PHONE IMPORT FAILED ===', importError);
    }

    return new Response(JSON.stringify({
      success: true,
      agent_id: agentData.agent_id,
      message: 'Agent created successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error creating ElevenLabs agent:', error);
    return new Response(JSON.stringify({ error: 'Failed to create agent' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
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

  try {
    // Step 1: Get Twilio credentials - from env vars in local mode, or from org record
    const USE_LOCAL_SUBACCOUNT = Deno.env.get('USE_LOCAL_SUBACCOUNT') === 'true';
    const LOCAL_SUBACCOUNT_SID = Deno.env.get('LOCAL_SUBACCOUNT_SID');
    const LOCAL_SUBACCOUNT_AUTH_TOKEN = Deno.env.get('LOCAL_SUBACCOUNT_AUTH_TOKEN');

    let twilioSid: string | undefined;
    let twilioToken: string | undefined;

    if (USE_LOCAL_SUBACCOUNT || config.isLocal) {
      // Use local environment variables
      twilioSid = LOCAL_SUBACCOUNT_SID;
      twilioToken = LOCAL_SUBACCOUNT_AUTH_TOKEN;
      console.log('[ElevenLabs Phone Import] Using local Twilio credentials from env');
    } else {
      // Get from organization record
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select('twilio_subaccount_sid, twilio_subaccount_auth_token')
        .eq('id', organizationId)
        .single();

      if (orgError || !orgData) {
        console.log('[ElevenLabs Phone Import] No organization found:', orgError?.message);
        return;
      }

      twilioSid = orgData.twilio_subaccount_sid;
      twilioToken = orgData.twilio_subaccount_auth_token;
      console.log('[ElevenLabs Phone Import] Using org Twilio credentials');
    }

    if (!twilioSid || !twilioToken) {
      console.log('[ElevenLabs Phone Import] No Twilio credentials available');
      return;
    }

    console.log('[ElevenLabs Phone Import] Found Twilio credentials, SID:', twilioSid);

    // Step 2: Get the phone number for this organization
    const { data: phoneData, error: phoneError } = await supabase
      .from('phone_numbers')
      .select('id, phone_number, elevenlabs_phone_number_id')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .maybeSingle();

    if (phoneError || !phoneData) {
      console.log('[ElevenLabs Phone Import] No phone number found:', phoneError?.message);
      return;
    }

    console.log('[ElevenLabs Phone Import] Found phone number:', phoneData.phone_number);

    // Step 3: Check if already imported - if so, just assign the agent
    if (phoneData.elevenlabs_phone_number_id) {
      console.log('[ElevenLabs Phone Import] Phone already imported, assigning agent');
      const assignResponse = await fetch(
        `https://api.elevenlabs.io/v1/convai/phone-numbers/${phoneData.elevenlabs_phone_number_id}`,
        {
          method: 'PATCH',
          headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ agent_id: agentId }),
        }
      );
      const assignText = await assignResponse.text();
      console.log('[ElevenLabs Phone Import] Agent assignment result:', assignResponse.status, assignText);
      return;
    }

    // Step 4: Import phone number to ElevenLabs
    // API: POST https://api.elevenlabs.io/v1/convai/phone-numbers
    const importPayload = {
      phone_number: phoneData.phone_number,
      label: agentLabel,
      provider: 'twilio',
      sid: twilioSid,
      token: twilioToken,
    };

    console.log('[ElevenLabs Phone Import] Sending import request:', {
      phone_number: phoneData.phone_number,
      label: agentLabel,
      provider: 'twilio',
    });

    const importResponse = await fetch('https://api.elevenlabs.io/v1/convai/phone-numbers', {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(importPayload),
    });

    const importText = await importResponse.text();
    console.log('[ElevenLabs Phone Import] Import response:', importResponse.status, importText);

    if (!importResponse.ok) {
      console.error('[ElevenLabs Phone Import] Failed to import phone number');
      return;
    }

    const importData = JSON.parse(importText);
    const phoneNumberId = importData.phone_number_id;

    // Step 5: Save the ElevenLabs phone number ID to database
    const { error: updateError } = await supabase
      .from('phone_numbers')
      .update({ elevenlabs_phone_number_id: phoneNumberId })
      .eq('id', phoneData.id);

    if (updateError) {
      console.error('[ElevenLabs Phone Import] Failed to save phone_number_id:', updateError.message);
    } else {
      console.log('[ElevenLabs Phone Import] Saved phone_number_id to database');
    }

    // Step 6: Assign the agent to the imported phone number
    // API: PATCH https://api.elevenlabs.io/v1/convai/phone-numbers/{phone_number_id}
    console.log('[ElevenLabs Phone Import] Assigning agent to phone number');
    const assignResponse = await fetch(
      `https://api.elevenlabs.io/v1/convai/phone-numbers/${phoneNumberId}`,
      {
        method: 'PATCH',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ agent_id: agentId }),
      }
    );

    const assignText = await assignResponse.text();
    console.log('[ElevenLabs Phone Import] Agent assignment result:', assignResponse.status, assignText);

    if (assignResponse.ok) {
      console.log('[ElevenLabs Phone Import] Successfully imported phone and assigned agent');
    }
  } catch (error) {
    console.error('[ElevenLabs Phone Import] Error:', error);
  }
}

async function buildAgentPrompt(
  supabase: any,
  orgData: any, 
  context: string
): Promise<{ prompt: string; firstMessage: string }> {
  let greeting = '';
  let content = '';
  
  // Try to parse structured context
  try {
    const parsed = JSON.parse(context);
    greeting = parsed.greeting || '';
    content = parsed.content || '';
  } catch {
    content = context;
  }

  // Fetch prompt templates from database
  const { data: templates, error: templatesError } = await supabase
    .from('prompt_templates')
    .select('name, template')
    .eq('is_active', true);

  if (templatesError) {
    console.error('Error fetching prompt templates:', templatesError);
  }

  // Create a map for easy lookup
  const templateMap: Record<string, string> = {};
  if (templates) {
    for (const t of templates) {
      templateMap[t.name] = t.template;
    }
  }

  // Get templates with fallbacks
  const basePromptTemplate = templateMap['agent_base_prompt'] || getDefaultBasePrompt();
  const firstMessageTemplate = templateMap['agent_first_message'] || 'Hello! Thanks for calling {{orgName}}. How can I help you today?';
  const contextPrefix = templateMap['agent_context_prefix'] || 'ADDITIONAL BUSINESS CONTEXT:';

  // Replace placeholders in templates
  const replacePlaceholders = (template: string): string => {
    return template
      .replace(/\{\{orgName\}\}/g, orgData.name)
      .replace(/\{\{businessHoursStart\}\}/g, orgData.business_hours_start || '8:00 AM')
      .replace(/\{\{businessHoursEnd\}\}/g, orgData.business_hours_end || '5:00 PM');
  };

  // Build first message
  const firstMessage = greeting || replacePlaceholders(firstMessageTemplate);

  // Build full prompt
  let fullPrompt = replacePlaceholders(basePromptTemplate);
  if (content && content.trim()) {
    fullPrompt = `${fullPrompt}

${contextPrefix}
${content}`;
  }

  console.log('Built agent prompt from database templates');

  return { prompt: fullPrompt, firstMessage };
}

// Fallback if database templates not available
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

async function handleUpdateAgent(
  supabase: any,
  organizationId: string,
  context?: string,
  voiceId?: string
) {
  const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
  
  if (!ELEVENLABS_API_KEY) {
    return new Response(JSON.stringify({ error: 'ElevenLabs API key not configured' }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  if (!organizationId) {
    return new Response(JSON.stringify({ error: 'Organization ID is required' }), { 
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  console.log(`Updating ElevenLabs agent for organization: ${organizationId}`);

  // Get organization details
  const { data: orgData, error: orgError } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', organizationId)
    .single();

  if (orgError) {
    console.error('Error fetching organization:', orgError);
    return new Response(JSON.stringify({ error: 'Organization not found' }), { 
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Get existing agent record
  const { data: agentRecord, error: agentError } = await supabase
    .from('organization_agents')
    .select('*')
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (!agentRecord?.elevenlabs_agent_id) {
    console.log('No existing agent found, creating new one');
    return handleCreateAgent(supabase, organizationId, context);
  }

  const agentContext = context || agentRecord?.context || '';
  const { prompt: systemPrompt, firstMessage } = await buildAgentPrompt(supabase, orgData, agentContext);

  // Get LLM model from agent context or use default
  let llmModel = 'gemini-2.5-flash';
  try {
    const parsed = JSON.parse(agentContext);
    if (parsed.llmModel) {
      llmModel = parsed.llmModel;
    }
  } catch {
    // Use default model
  }

  const updateConfig: any = {
    conversation_config: {
      agent: {
        first_message: firstMessage,
        prompt: {
          prompt: systemPrompt
        },
        llm: {
          model: llmModel
        }
      }
    }
  };

  // Add voice configuration if provided
  if (voiceId) {
    updateConfig.conversation_config.tts = {
      voice_id: voiceId
    };
    console.log('Setting voice ID:', voiceId);
  }

  try {
    console.log('Updating ElevenLabs agent:', agentRecord.elevenlabs_agent_id);

    const response = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentRecord.elevenlabs_agent_id}`, {
      method: 'PATCH',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateConfig),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs agent update error:', response.status, errorText);
      return new Response(JSON.stringify({ error: `Failed to update agent: ${errorText}` }), { 
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const agentData = await response.json();
    console.log('ElevenLabs agent updated:', agentData);
    
    // Update context in database
    await supabase
      .from('organization_agents')
      .update({ context: agentContext || null })
      .eq('organization_id', organizationId);

    return new Response(JSON.stringify({
      success: true,
      agent_id: agentRecord.elevenlabs_agent_id,
      message: 'Agent updated successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error updating ElevenLabs agent:', error);
    return new Response(JSON.stringify({ error: 'Failed to update agent' }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function handleRenameAgent(
  supabase: any,
  organizationId: string,
  name: string
) {
  const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
  
  if (!ELEVENLABS_API_KEY) {
    return new Response(JSON.stringify({ error: 'ElevenLabs API key not configured' }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  if (!organizationId || !name) {
    return new Response(JSON.stringify({ error: 'Organization ID and name are required' }), { 
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  console.log(`Renaming ElevenLabs agent for organization: ${organizationId} to: ${name}`);

  // Get existing agent record
  const { data: agentRecord, error: agentError } = await supabase
    .from('organization_agents')
    .select('elevenlabs_agent_id')
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (!agentRecord?.elevenlabs_agent_id) {
    console.log('No existing agent found, nothing to rename');
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'No agent exists to rename' 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Build agent name with environment and mode prefix
  const envPrefix = config.isLocal ? '[LOCAL]' : config.isDevelopment ? '[DEV]' : '';
  const modePrefix = '[INBOUND]'; // TODO: Pass mode from dashboard when outbound is supported
  const agentName = `${envPrefix}${modePrefix} ${name} - ${organizationId}`;

  const updateConfig = {
    name: agentName
  };

  try {
    console.log('Renaming ElevenLabs agent:', agentRecord.elevenlabs_agent_id);

    const response = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentRecord.elevenlabs_agent_id}`, {
      method: 'PATCH',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateConfig),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs agent rename error:', response.status, errorText);
      return new Response(JSON.stringify({ error: `Failed to rename agent: ${errorText}` }), { 
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const agentData = await response.json();
    console.log('ElevenLabs agent renamed:', agentData);

    return new Response(JSON.stringify({
      success: true,
      agent_id: agentRecord.elevenlabs_agent_id,
      message: 'Agent renamed successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error renaming ElevenLabs agent:', error);
    return new Response(JSON.stringify({ error: 'Failed to rename agent' }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
