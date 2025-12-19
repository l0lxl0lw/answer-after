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
    const callStatus = formData['CallStatus'] || '';
    const callDuration = formData['CallDuration'] ? parseInt(formData['CallDuration'], 10) : null;

    console.log(`Call SID: ${callSid}, Status: ${callStatus}, Duration: ${callDuration}`);

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
            outcome = 'escalated';
          } else if (fullConvo.includes('message') || fullConvo.includes('call back')) {
            outcome = 'callback_requested';
          } else {
            outcome = 'information_provided';
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

    let agentId = null;

    if (phoneData) {
      // Get organization info including ElevenLabs agent ID
      const { data: orgData } = await supabase
        .from('organizations')
        .select('elevenlabs_agent_id')
        .eq('id', phoneData.organization_id)
        .single();
      
      agentId = orgData?.elevenlabs_agent_id;

      // Create or find call record
      const { data: existingCall } = await supabase
        .from('calls')
        .select('id')
        .eq('twilio_call_sid', callSid)
        .maybeSingle();

      if (!existingCall) {
        await supabase
          .from('calls')
          .insert({
            organization_id: phoneData.organization_id,
            phone_number_id: phoneData.id,
            twilio_call_sid: callSid,
            caller_phone: callerPhone,
            status: 'active',
            is_emergency: false,
            started_at: new Date().toISOString(),
          });
      }
    }

    // If no agent ID, create one or use fallback
    if (!agentId) {
      console.log('No ElevenLabs agent found, using fallback TTS');
      // Fallback to simple greeting for now
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="Polly.Joanna-Neural">Hi! Thanks for calling AnswerAfter. Please hold while we connect you to our AI assistant.</Say>
    <Hangup/>
</Response>`;

      return new Response(twiml, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/xml',
        },
      });
    }

    // Use Twilio Streams to connect to ElevenLabs agent
    const wsUrl = `${supabaseUrl}/functions/v1/elevenlabs-agent/websocket?callSid=${callSid}&agentId=${agentId}`;
    
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Connect>
        <Stream url="${wsUrl}" />
    </Connect>
</Response>`;

    console.log('Returning Streams TwiML with agent ID:', agentId);

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
