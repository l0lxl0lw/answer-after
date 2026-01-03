import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient } from "../_shared/db.ts";
import { corsHeaders } from "../_shared/errors.ts";
import { createLogger } from "../_shared/logger.ts";

const logger = createLogger('twilio-webhook');

// Feature flag for workflow-based agents (must match elevenlabs-agent)
const USE_WORKFLOW_AGENTS = Deno.env.get('USE_WORKFLOW_AGENTS') === 'true';

// Detect interest level from conversation text
async function detectInterestLevel(conversationText: string): Promise<'hot' | 'warm' | 'cold'> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

  const prompt = `Analyze this customer service call and determine the caller's interest level.
Return ONLY one word: "hot", "warm", or "cold"

- HOT: Caller asked about pricing, scheduling, availability, expressed urgency, mentioned specific services, or showed clear intent to book
- WARM: Caller showed general interest, asked questions, but no immediate booking intent
- COLD: Brief call, minimal engagement, just seeking basic information, or call ended quickly

Conversation:
${conversationText}`;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 10,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      return 'warm'; // Default on error
    }

    const data = await response.json();
    const level = (data.choices[0]?.message?.content || 'warm').toLowerCase().trim();
    return ['hot', 'warm', 'cold'].includes(level) ? level as 'hot' | 'warm' | 'cold' : 'warm';
  } catch {
    return 'warm'; // Default on error
  }
}

/**
 * Get dynamic variables for workflow agents
 * These are passed to ElevenLabs and used in the workflow
 */
async function getDynamicVariablesForWorkflow(
  supabase: any,
  institutionId: string,
  callerPhone: string
): Promise<Record<string, string>> {
  // Get institution
  const { data: org } = await supabase
    .from('accounts')
    .select('name, workflow_config, notification_phone')
    .eq('id', institutionId)
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

// AI conversation using Lovable AI Gateway
async function getAIResponse(conversationHistory: Array<{role: string, content: string}>, organizationContext: any) {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

  const systemPrompt = `You are a friendly AI receptionist for AnswerAfter, a professional dental office.

Your responsibilities:
1. Greet callers warmly
2. Ask how you can help them today
3. Gather information about their dental concern (symptoms, urgency level)
4. Collect their contact information (name, phone)
5. Help schedule appointments if needed
6. Handle emergencies by noting them as urgent

Keep your responses SHORT and conversational - this is a phone call. 2-3 sentences max.
Be warm, professional, and helpful.

If the caller describes an emergency (severe tooth pain, dental abscess, broken tooth, knocked-out tooth, uncontrolled bleeding), acknowledge the urgency and assure them we will get them seen as soon as possible.

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
    const log = logger.withContext({ requestId: crypto.randomUUID() });
    const url = new URL(req.url);
    const contentType = req.headers.get('content-type') || '';

    log.info('Webhook received', { method: req.method, path: url.pathname });

    // Parse form data from Twilio
    let formData: Record<string, string> = {};

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const body = await req.text();
      const params = new URLSearchParams(body);
      params.forEach((value, key) => {
        formData[key] = value;
      });
    }

    // Extract Twilio call data
    const callSid = formData['CallSid'];
    const callerPhone = formData['From'] || 'unknown';
    const calledNumber = formData['To'] || '';
    const callStatus = formData['CallStatus'] || '';
    const callDuration = formData['CallDuration'] ? parseInt(formData['CallDuration'], 10) : null;

    log.info('Call data', { callSid, status: callStatus, duration: callDuration });

    const supabase = createServiceClient();

    // Handle call completion status callbacks (when customer hangs up)
    if (callStatus === 'completed' || callStatus === 'busy' || callStatus === 'no-answer' || callStatus === 'failed' || callStatus === 'canceled') {
      log.info('Call ended', { callSid, status: callStatus });

      // Find the call record with contact
      const { data: existingCall } = await supabase
        .from('calls')
        .select('id, is_emergency, account_id, contact_id, caller_phone')
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
            log.warn('Error generating summary', { error: (e as Error).message });
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

        // Detect interest level for non-booked calls (leads)
        let interestLevel: 'hot' | 'warm' | 'cold' | null = null;
        if (outcome !== 'booked' && events && events.length > 0) {
          const conversationText = events.map(e =>
            `Customer: ${e.ai_prompt || ''}\nAI: ${e.ai_response || ''}`
          ).join('\n');
          interestLevel = await detectInterestLevel(conversationText);
          log.info('Interest level detected', { callId: existingCall.id, interestLevel });
        }

        // Update call record
        await supabase
          .from('calls')
          .update({
            status: dbStatus,
            ended_at: new Date().toISOString(),
            duration_seconds: callDuration,
            outcome: outcome,
            summary: summary,
            ...(interestLevel && { interest_level: interestLevel }),
          })
          .eq('id', existingCall.id);

        log.info('Call record updated', { callId: existingCall.id, status: dbStatus, outcome, interestLevel, duration: callDuration });

        // Update contact based on outcome
        if (existingCall.contact_id) {
          const contactUpdate: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
          };

          // If booked, upgrade contact to customer
          if (outcome === 'booked') {
            contactUpdate.status = 'customer';
            log.info('Contact upgraded to customer', { contactId: existingCall.contact_id });
          } else if (interestLevel) {
            // Update interest level for leads
            contactUpdate.interest_level = interestLevel;
          }

          await supabase
            .from('contacts')
            .update(contactUpdate)
            .eq('id', existingCall.contact_id);
        } else if (existingCall.account_id && existingCall.caller_phone) {
          // If no contact_id on call, try to find/update contact by phone
          const contactUpdate: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
          };

          if (outcome === 'booked') {
            contactUpdate.status = 'customer';
          } else if (interestLevel) {
            contactUpdate.interest_level = interestLevel;
          }

          await supabase
            .from('contacts')
            .update(contactUpdate)
            .eq('account_id', existingCall.account_id)
            .eq('phone', existingCall.caller_phone);
        }

        // Deduct credits based on call duration (1 credit per second)
        // Priority: Use purchased credits first, then plan credits
        if (callDuration && callDuration > 0 && existingCall.account_id) {
          let remainingToDeduct = callDuration;
          let purchasedCreditsUsed = 0;
          let planCreditsUsed = 0;

          // First, try to deduct from purchased credits (FIFO - oldest first)
          const { data: purchasedCredits } = await supabase
            .from('purchased_credits')
            .select('id, credits_remaining')
            .eq('account_id', existingCall.account_id)
            .gt('credits_remaining', 0)
            .order('purchased_at', { ascending: true });

          if (purchasedCredits && purchasedCredits.length > 0) {
            for (const pc of purchasedCredits) {
              if (remainingToDeduct <= 0) break;

              const deductFromThis = Math.min(remainingToDeduct, pc.credits_remaining);
              const newRemaining = pc.credits_remaining - deductFromThis;

              await supabase
                .from('purchased_credits')
                .update({ credits_remaining: newRemaining })
                .eq('id', pc.id);

              purchasedCreditsUsed += deductFromThis;
              remainingToDeduct -= deductFromThis;
            }
          }

          // If there's still credits to deduct, use plan credits
          if (remainingToDeduct > 0) {
            const { data: subscription } = await supabase
              .from('subscriptions')
              .select('id, used_credits, total_credits')
              .eq('account_id', existingCall.account_id)
              .maybeSingle();

            if (subscription) {
              const availablePlanCredits = subscription.total_credits - subscription.used_credits;
              planCreditsUsed = Math.min(remainingToDeduct, availablePlanCredits);

              const newUsedCredits = subscription.used_credits + planCreditsUsed;

              await supabase
                .from('subscriptions')
                .update({ used_credits: newUsedCredits })
                .eq('id', subscription.id);
            }
          }

          log.info('Credits deducted', {
            institutionId: existingCall.account_id,
            callDuration,
            purchasedCreditsUsed,
            planCreditsUsed,
            totalDeducted: purchasedCreditsUsed + planCreditsUsed
          });
        }
      }

      // Return empty TwiML for status callback
      return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
        headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
      });
    }

    // Find phone number and organization
    const { data: phoneData } = await supabase
      .from('phone_numbers')
      .select('id, account_id')
      .eq('phone_number', calledNumber)
      .eq('is_active', true)
      .maybeSingle();

    let agentId = null;

    if (phoneData) {
      // Get ElevenLabs agent ID from account_agents table
      const { data: agentData } = await supabase
        .from('account_agents')
        .select('elevenlabs_agent_id')
        .eq('account_id', phoneData.account_id)
        .maybeSingle();

      agentId = agentData?.elevenlabs_agent_id;
      log.info('Agent found', { institutionId: phoneData.account_id, agentId });

      // Create or find call record
      const { data: existingCall } = await supabase
        .from('calls')
        .select('id')
        .eq('twilio_call_sid', callSid)
        .maybeSingle();

      if (!existingCall) {
        // Upsert contact by phone (create as lead if new)
        const { data: contact } = await supabase
          .from('contacts')
          .upsert({
            account_id: phoneData.account_id,
            phone: callerPhone,
            status: 'lead',
            source: 'inbound_call',
          }, {
            onConflict: 'account_id,phone',
            ignoreDuplicates: false,
          })
          .select('id')
          .single();

        log.info('Contact upserted', { contactId: contact?.id, phone: callerPhone });

        // Create call record linked to contact
        await supabase
          .from('calls')
          .insert({
            account_id: phoneData.account_id,
            phone_number_id: phoneData.id,
            contact_id: contact?.id || null,
            twilio_call_sid: callSid,
            caller_phone: callerPhone,
            status: 'active',
            is_emergency: false,
            started_at: new Date().toISOString(),
          });
      }
    }

    // Check if there's a pre-generated greeting audio for this organization
    let greetingAudioUrl: string | null = null;
    if (phoneData) {
      const { data: greetingFile } = await supabase.storage
        .from('greetings')
        .getPublicUrl(`${phoneData.account_id}/greeting.mp3`);

      // Check if file exists by trying to fetch its metadata
      const { data: fileList } = await supabase.storage
        .from('greetings')
        .list(phoneData.account_id);

      if (fileList && fileList.some(f => f.name === 'greeting.mp3')) {
        greetingAudioUrl = greetingFile.publicUrl;
        log.info('Greeting audio found', { institutionId: phoneData.account_id });
      }
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;

    // If no agent ID, use fallback
    if (!agentId) {
      log.info('No ElevenLabs agent found, using fallback TTS');

      let twiml: string;
      if (greetingAudioUrl) {
        twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Play>${greetingAudioUrl}</Play>
    <Pause length="1"/>
    <Say voice="Polly.Joanna-Neural">Please hold while we connect you to an agent.</Say>
    <Hangup/>
</Response>`;
      } else {
        twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="Polly.Joanna-Neural">Hi! Thanks for calling AnswerAfter. Please hold while we connect you to our AI assistant.</Say>
    <Hangup/>
</Response>`;
      }

      return new Response(twiml, {
        headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
      });
    }

    // Build WebSocket URL to our edge function that bridges Twilio <-> ElevenLabs
    let wsUrl = `${supabaseUrl.replace('https://', 'wss://')}/functions/v1/elevenlabs-agent?agentId=${agentId}&callSid=${callSid}`;

    // For workflow agents, fetch and pass dynamic variables
    if (USE_WORKFLOW_AGENTS && phoneData) {
      const dynamicVars = await getDynamicVariablesForWorkflow(supabase, phoneData.account_id, callerPhone);
      // Append dynamic variables as query parameters
      const varsParams = new URLSearchParams();
      for (const [key, value] of Object.entries(dynamicVars)) {
        if (value) {
          varsParams.set(key, value);
        }
      }
      wsUrl = `${wsUrl}&${varsParams.toString()}`;
      log.info('Workflow dynamic variables', { ...dynamicVars });
    }

    log.info('Returning Streams TwiML', { wsUrl, useWorkflow: USE_WORKFLOW_AGENTS });

    // Play custom greeting audio first, then connect to AI agent
    let twiml: string;
    if (greetingAudioUrl) {
      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Play>${greetingAudioUrl}</Play>
    <Connect>
        <Stream url="${wsUrl}" />
    </Connect>
</Response>`;
    } else {
      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Connect>
        <Stream url="${wsUrl}" />
    </Connect>
</Response>`;
    }

    return new Response(twiml, {
      headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
    });

  } catch (error) {
    logger.error('Handler error', error as Error);

    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="Polly.Joanna-Neural">We're experiencing technical difficulties. Please try again later or call back during business hours.</Say>
    <Hangup/>
</Response>`;

    return new Response(errorTwiml, {
      headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
    });
  }
});
