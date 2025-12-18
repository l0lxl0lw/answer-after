import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// AI conversation using Lovable AI Gateway
async function getAIResponse(conversationHistory: Array<{role: string, content: string}>, organizationContext: any) {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  const systemPrompt = `You are a friendly AI receptionist for AnswerAfter, a professional HVAC and plumbing service company.

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

Current organization: ${organizationContext?.name || 'AnswerAfter'}
Business hours: ${organizationContext?.business_hours_start || '8:00 AM'} to ${organizationContext?.business_hours_end || '5:00 PM'}

When you have gathered enough information (name, phone, address, issue description), summarize the appointment details and confirm with the caller.`;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          ...conversationHistory
        ],
        max_tokens: 150,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      console.error('AI Gateway error:', response.status, await response.text());
      return "I'm having trouble understanding. Could you please repeat that?";
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || "I'm sorry, I didn't catch that. Could you repeat?";
  } catch (error) {
    console.error('AI response error:', error);
    return "I'm sorry, I'm having technical difficulties. Please hold.";
  }
}

// Generate audio URL using ElevenLabs TTS and upload to storage
async function generateElevenLabsAudio(text: string, supabase: any): Promise<string | null> {
  const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  
  if (!ELEVENLABS_API_KEY) {
    console.error('ELEVENLABS_API_KEY not configured');
    return null;
  }

  try {
    // Use Sarah voice - natural and warm
    const voiceId = 'EXAVITQu4vr4xnSDxMaL';
    
    console.log('Generating ElevenLabs audio for:', text.substring(0, 50) + '...');
    
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_flash_v2_5',
        output_format: 'mp3_44100_128',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.3,
          use_speaker_boost: true,
        },
      }),
    });

    if (!response.ok) {
      console.error('ElevenLabs error:', response.status, await response.text());
      return null;
    }

    const audioBuffer = await response.arrayBuffer();
    const fileName = `tts-${Date.now()}-${Math.random().toString(36).substring(7)}.mp3`;
    
    console.log('Uploading audio to storage:', fileName);
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('tts-audio')
      .upload(fileName, audioBuffer, {
        contentType: 'audio/mpeg',
        upsert: false,
      });

    if (error) {
      console.error('Storage upload error:', error);
      return null;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('tts-audio')
      .getPublicUrl(fileName);

    console.log('Audio uploaded successfully:', urlData.publicUrl);
    return urlData.publicUrl;
  } catch (error) {
    console.error('ElevenLabs TTS error:', error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const contentType = req.headers.get('content-type') || '';
    
    console.log('Twilio webhook received:', req.method, url.pathname);

    // Parse form data from Twilio
    let formData: Record<string, string> = {};
    
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const body = await req.text();
      const params = new URLSearchParams(body);
      params.forEach((value, key) => {
        formData[key] = value;
      });
    }

    console.log('Form data:', JSON.stringify(formData));

    // Extract Twilio call data
    const callSid = formData['CallSid'];
    const callerPhone = formData['From'] || 'unknown';
    const calledNumber = formData['To'] || '';
    const speechResult = formData['SpeechResult'] || '';
    const digits = formData['Digits'] || '';
    const callStatus = formData['CallStatus'] || '';
    const callDuration = formData['CallDuration'] ? parseInt(formData['CallDuration'], 10) : null;

    console.log(`Call SID: ${callSid}, Status: ${callStatus}, Speech: "${speechResult}", Duration: ${callDuration}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Handle call completion status callbacks (when customer hangs up)
    if (callStatus === 'completed' || callStatus === 'busy' || callStatus === 'no-answer' || callStatus === 'failed' || callStatus === 'canceled') {
      console.log(`Call ${callSid} ended with status: ${callStatus}`);
      
      // Find the call record
      const { data: existingCall } = await supabase
        .from('calls')
        .select('id, is_emergency')
        .eq('twilio_call_sid', callSid)
        .maybeSingle();

      if (existingCall) {
        // Get conversation history to generate summary
        const { data: events } = await supabase
          .from('call_events')
          .select('ai_prompt, ai_response')
          .eq('call_id', existingCall.id)
          .order('created_at', { ascending: true });

        let summary = 'Call ended';
        let outcome: string = 'no_action';

        if (events && events.length > 0) {
          // Build conversation for summary
          const conversationText = events.map(e => 
            `Customer: ${e.ai_prompt || ''}\nAI: ${e.ai_response || ''}`
          ).join('\n');

          // Generate summary using AI
          try {
            const summaryResponse = await getAIResponse([
              { role: 'user', content: `Summarize this customer service call in 1-2 sentences. Focus on what the customer needed and the outcome:\n\n${conversationText}` }
            ], null);
            summary = summaryResponse;
          } catch (e) {
            console.error('Error generating summary:', e);
            summary = `Call with ${events.length} conversation exchanges`;
          }

          // Determine outcome based on conversation
          const fullConvo = conversationText.toLowerCase();
          if (fullConvo.includes('appointment') || fullConvo.includes('schedule') || fullConvo.includes('book')) {
            outcome = 'booked';
          } else if (existingCall.is_emergency) {
            outcome = 'dispatched';
          } else if (fullConvo.includes('message') || fullConvo.includes('call back')) {
            outcome = 'message_taken';
          } else {
            outcome = 'resolved';
          }
        }

        // Map Twilio status to our status
        let dbStatus: string = 'completed';
        if (callStatus === 'failed') dbStatus = 'failed';
        if (callStatus === 'no-answer' || callStatus === 'busy') dbStatus = 'failed';

        // Update call record
        await supabase
          .from('calls')
          .update({
            status: dbStatus,
            ended_at: new Date().toISOString(),
            duration_seconds: callDuration,
            outcome: outcome,
            summary: summary,
          })
          .eq('id', existingCall.id);

        console.log(`Updated call ${existingCall.id}: status=${dbStatus}, outcome=${outcome}, duration=${callDuration}s`);
      }

      // Return empty TwiML for status callback
      return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
        headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
      });
    }

    // Find phone number and organization
    const { data: phoneData } = await supabase
      .from('phone_numbers')
      .select('id, organization_id')
      .eq('phone_number', calledNumber)
      .eq('is_active', true)
      .maybeSingle();

    let organizationContext = null;
    let callId = null;

    if (phoneData) {
      // Get organization info
      const { data: orgData } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', phoneData.organization_id)
        .single();
      
      organizationContext = orgData;

      // Find or create call record
      const { data: existingCall } = await supabase
        .from('calls')
        .select('id')
        .eq('twilio_call_sid', callSid)
        .maybeSingle();

      if (existingCall) {
        callId = existingCall.id;
      } else {
        const { data: newCall } = await supabase
          .from('calls')
          .insert({
            organization_id: phoneData.organization_id,
            phone_number_id: phoneData.id,
            twilio_call_sid: callSid,
            caller_phone: callerPhone,
            status: 'in_progress',
            is_emergency: false,
            started_at: new Date().toISOString(),
          })
          .select()
          .single();
        
        if (newCall) {
          callId = newCall.id;
        }
      }
    }

    // Get conversation history from call events
    let conversationHistory: Array<{role: string, content: string}> = [];
    
    if (callId) {
      const { data: events } = await supabase
        .from('call_events')
        .select('event_type, ai_prompt, ai_response')
        .eq('call_id', callId)
        .order('created_at', { ascending: true });

      if (events) {
        for (const event of events) {
          if (event.ai_prompt) {
            conversationHistory.push({ role: 'user', content: event.ai_prompt });
          }
          if (event.ai_response) {
            conversationHistory.push({ role: 'assistant', content: event.ai_response });
          }
        }
      }
    }

    let aiResponse: string;

    // Determine response based on conversation state
    if (!speechResult && conversationHistory.length === 0) {
      // Initial greeting
      aiResponse = "Hi! Thanks for calling AnswerAfter. I'm here to help you with any HVAC or plumbing needs. How can I assist you today?";
    } else if (speechResult) {
      // Add user's speech to history
      conversationHistory.push({ role: 'user', content: speechResult });
      
      // Get AI response
      aiResponse = await getAIResponse(conversationHistory, organizationContext);

      // Check for emergency keywords
      const emergencyKeywords = organizationContext?.emergency_keywords || ['no heat', 'no cooling', 'gas leak', 'flooding'];
      const isEmergency = emergencyKeywords.some((keyword: string) => 
        speechResult.toLowerCase().includes(keyword.toLowerCase())
      );

      if (isEmergency && callId) {
        await supabase
          .from('calls')
          .update({ is_emergency: true })
          .eq('id', callId);
      }

      // Store the conversation exchange
      if (callId) {
        await supabase
          .from('call_events')
          .insert({
            call_id: callId,
            event_type: 'conversation',
            ai_prompt: speechResult,
            ai_response: aiResponse,
            event_data: { 
              is_emergency: isEmergency,
              conversation_turn: conversationHistory.length 
            },
          });

        // Update call summary
        await supabase
          .from('calls')
          .update({ 
            summary: `Conversation with ${conversationHistory.length} exchanges. Last: "${speechResult.substring(0, 100)}"`,
          })
          .eq('id', callId);
      }
    } else {
      // No speech detected, prompt again
      aiResponse = "I'm sorry, I didn't catch that. Could you please tell me how I can help you today?";
    }

    // Check if conversation seems complete (booking confirmed or caller says goodbye)
    const goodbyePatterns = ['goodbye', 'bye', 'thank you', 'thanks', 'that\'s all', 'have a good'];
    const isEnding = goodbyePatterns.some(pattern => 
      speechResult.toLowerCase().includes(pattern)
    );

    console.log('AI Response:', aiResponse);

    // Build TwiML response - try ElevenLabs first, fall back to Polly
    let twiml: string;
    
    // Helper function to build TwiML with audio
    const buildTwimlWithAudio = async (text: string, includeGather: boolean): Promise<string> => {
      const audioUrl = await generateElevenLabsAudio(text, supabase);
      
      if (audioUrl) {
        if (includeGather) {
          return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Gather input="speech" timeout="5" speechTimeout="auto" action="${supabaseUrl}/functions/v1/twilio-webhook">
        <Play>${audioUrl}</Play>
    </Gather>
    <Say voice="Polly.Joanna-Neural">I'm sorry, I didn't hear anything. Let me transfer you to our team.</Say>
    <Hangup/>
</Response>`;
        } else {
          return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Play>${audioUrl}</Play>
    <Hangup/>
</Response>`;
        }
      } else {
        // Fallback to Polly if ElevenLabs fails
        console.log('Falling back to Polly TTS');
        if (includeGather) {
          return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Gather input="speech" timeout="5" speechTimeout="auto" action="${supabaseUrl}/functions/v1/twilio-webhook">
        <Say voice="Polly.Joanna-Neural">${escapeXml(text)}</Say>
    </Gather>
    <Say voice="Polly.Joanna-Neural">I'm sorry, I didn't hear anything. Let me transfer you to our team.</Say>
    <Hangup/>
</Response>`;
        } else {
          return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="Polly.Joanna-Neural">${escapeXml(text)}</Say>
    <Hangup/>
</Response>`;
        }
      }
    };
    
    if (isEnding) {
      // End the call gracefully
      const endingMessage = `${aiResponse} Have a great day! Goodbye.`;
      twiml = await buildTwimlWithAudio(endingMessage, false);

      // Mark call as completed
      if (callId) {
        await supabase
          .from('calls')
          .update({ 
            status: 'completed',
            ended_at: new Date().toISOString(),
            outcome: 'resolved',
          })
          .eq('id', callId);
      }
    } else {
      // Continue conversation - gather more speech
      twiml = await buildTwimlWithAudio(aiResponse, true);
    }

    console.log('Returning TwiML');

    return new Response(twiml, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/xml',
      },
    });

  } catch (error) {
    console.error('Error in twilio-webhook:', error);
    
    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="Polly.Joanna-Neural">We're experiencing technical difficulties. Please try again later or call back during business hours.</Say>
    <Hangup/>
</Response>`;

    return new Response(errorTwiml, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/xml',
      },
    });
  }
});

// Helper to escape XML special characters
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
