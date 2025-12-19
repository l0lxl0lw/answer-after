import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    console.log('ElevenLabs Agent WebSocket handler:', req.method, url.pathname);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (url.pathname === '/websocket') {
      // Handle WebSocket upgrade for ElevenLabs agent connection
      if (req.headers.get("upgrade") !== "websocket") {
        return new Response("Request must be websocket upgrade", { status: 400 });
      }

      const { socket, response } = Deno.upgradeWebSocket(req);
      
      const callSid = url.searchParams.get('callSid');
      const agentId = url.searchParams.get('agentId');
      
      if (!agentId) {
        socket.close(1000, 'Missing agentId parameter');
        return response;
      }

      console.log(`Setting up ElevenLabs agent connection for call ${callSid}`);

      // Connect to ElevenLabs agent
      const elevenlabsWs = new WebSocket(`wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${agentId}`);
      
      socket.onopen = () => {
        console.log(`WebSocket connection opened for call ${callSid}`);
      };

      // Forward audio from Twilio to ElevenLabs
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.event === 'media') {
            // Forward audio data to ElevenLabs agent
            const audioData = {
              type: 'audio_input',
              audio: message.media.payload
            };
            
            if (elevenlabsWs.readyState === WebSocket.OPEN) {
              elevenlabsWs.send(JSON.stringify(audioData));
            }
          } else if (message.event === 'start') {
            console.log('Twilio stream started for call:', message.start.callSid);
            
            // Store call metadata
            if (callSid) {
              supabase
                .from('calls')
                .update({ 
                  status: 'active',
                  started_at: new Date().toISOString() 
                })
                .eq('twilio_call_sid', callSid)
                .then(() => console.log('Updated call status to active'));
            }
          } else if (message.event === 'stop') {
            console.log('Twilio stream stopped');
            elevenlabsWs.close();
          }
        } catch (error) {
          console.error('Error processing Twilio message:', error);
        }
      };

      // Forward responses from ElevenLabs to Twilio
      elevenlabsWs.onmessage = (event) => {
        try {
          const response = JSON.parse(event.data);
          
          if (response.type === 'audio_output' && response.audio) {
            // Send audio back to Twilio
            const twilioMessage = {
              event: 'media',
              streamSid: url.searchParams.get('streamSid'),
              media: {
                payload: response.audio
              }
            };
            
            if (socket.readyState === WebSocket.OPEN) {
              socket.send(JSON.stringify(twilioMessage));
            }
          } else if (response.type === 'conversation_end') {
            console.log('ElevenLabs conversation ended');
            
            // Update call status
            if (callSid) {
              supabase
                .from('calls')
                .update({ 
                  status: 'completed',
                  ended_at: new Date().toISOString(),
                  summary: response.summary || 'Conversation completed'
                })
                .eq('twilio_call_sid', callSid)
                .then(() => console.log('Updated call status to completed'));
            }
            
            socket.close();
          }
        } catch (error) {
          console.error('Error processing ElevenLabs response:', error);
        }
      };

      elevenlabsWs.onerror = (error) => {
        console.error('ElevenLabs WebSocket error:', error);
        socket.close(1011, 'ElevenLabs connection failed');
      };

      elevenlabsWs.onclose = () => {
        console.log('ElevenLabs WebSocket closed');
        if (socket.readyState === WebSocket.OPEN) {
          socket.close();
        }
      };

      socket.onclose = () => {
        console.log('Twilio WebSocket closed');
        if (elevenlabsWs.readyState === WebSocket.OPEN) {
          elevenlabsWs.close();
        }
      };

      socket.onerror = (error) => {
        console.error('Twilio WebSocket error:', error);
        elevenlabsWs.close();
      };

      return response;
    }

    // Handle agent creation/management endpoints
    if (url.pathname === '/create-agent') {
      const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
      
      if (!ELEVENLABS_API_KEY) {
        return new Response('ElevenLabs API key not configured', { status: 500 });
      }

      const { organizationId, systemPrompt } = await req.json();

      // Get organization details for agent customization
      const { data: orgData } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', organizationId)
        .single();

      const agentConfig = {
        name: `${orgData?.name || 'AnswerAfter'} AI Assistant`,
        conversation_config: {
          agent: {
            prompt: {
              prompt: systemPrompt || `You are a friendly AI receptionist for ${orgData?.name || 'AnswerAfter'}, a professional HVAC and plumbing service company.

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

Business hours: ${orgData?.business_hours_start || '8:00 AM'} to ${orgData?.business_hours_end || '5:00 PM'}

When you have gathered enough information (name, phone, address, issue description), summarize the appointment details and confirm with the caller.`
            }
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
        const response = await fetch('https://api.elevenlabs.io/v1/convai/agents', {
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
          return new Response(`Failed to create agent: ${errorText}`, { status: response.status });
        }

        const agentData = await response.json();
        
        // Store agent ID in organization record
        await supabase
          .from('organizations')
          .update({ 
            elevenlabs_agent_id: agentData.agent_id,
            updated_at: new Date().toISOString()
          })
          .eq('id', organizationId);

        return new Response(JSON.stringify({
          success: true,
          agent_id: agentData.agent_id,
          message: 'Agent created successfully'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (error) {
        console.error('Error creating ElevenLabs agent:', error);
        return new Response('Failed to create agent', { status: 500 });
      }
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