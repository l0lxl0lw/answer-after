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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { reminderId, appointmentId } = await req.json();
    
    if (!reminderId && !appointmentId) {
      return new Response(JSON.stringify({ error: 'reminderId or appointmentId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get reminder details
    let reminder;
    if (reminderId) {
      const { data, error } = await supabase
        .from('appointment_reminders')
        .select('*, appointments(*)')
        .eq('id', reminderId)
        .single();
      
      if (error || !data) {
        console.error('Reminder not found:', error);
        return new Response(JSON.stringify({ error: 'Reminder not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      reminder = data;
    }

    const appointment = reminder.appointments;
    if (!appointment) {
      return new Response(JSON.stringify({ error: 'Appointment not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get organization details
    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', reminder.organization_id)
      .single();

    if (orgError || !orgData) {
      console.error('Organization not found:', orgError);
      return new Response(JSON.stringify({ error: 'Organization not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get organization's phone number
    const { data: phoneData } = await supabase
      .from('phone_numbers')
      .select('phone_number')
      .eq('organization_id', reminder.organization_id)
      .eq('is_active', true)
      .limit(1)
      .single();

    const fromNumber = phoneData?.phone_number || Deno.env.get('TWILIO_DEFAULT_FROM_NUMBER');
    if (!fromNumber) {
      return new Response(JSON.stringify({ error: 'No phone number configured' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get ElevenLabs agent for this organization
    const { data: agentData } = await supabase
      .from('organization_agents')
      .select('elevenlabs_agent_id')
      .eq('organization_id', reminder.organization_id)
      .single();

    if (!agentData?.elevenlabs_agent_id) {
      return new Response(JSON.stringify({ error: 'No AI agent configured for organization' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Update reminder status to in_progress
    await supabase
      .from('appointment_reminders')
      .update({ status: 'in_progress' })
      .eq('id', reminderId);

    // Format appointment time for the AI
    const appointmentDate = new Date(appointment.scheduled_start);
    const formattedDate = appointmentDate.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric' 
    });
    const formattedTime = appointmentDate.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit' 
    });

    // Build reminder-specific prompt
    const reminderPrompt = `You are making an outbound reminder call for ${orgData.name}.

CRITICAL: This is an OUTBOUND reminder call. You are calling the customer, not the other way around.

Customer Name: ${appointment.customer_name}
Appointment Date: ${formattedDate}
Appointment Time: ${formattedTime}
Service: ${appointment.issue_description}

Your goals:
1. Greet the customer by name
2. Remind them of their upcoming appointment
3. Ask if they can confirm they'll be there
4. If they want to reschedule, note that and let them know someone will call back with new times
5. If they want to cancel, acknowledge and note the cancellation

Keep responses SHORT (2-3 sentences max). Be friendly and professional.

Valid responses to look for:
- CONFIRMED: Customer confirms the appointment
- RESCHEDULE: Customer wants to reschedule
- CANCELLED: Customer wants to cancel
- NO_ANSWER: Went to voicemail or no answer

At the end, summarize the outcome clearly.`;

    // Make the outbound call via Twilio
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID')!;
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN')!;
    
    // Build TwiML for connecting to ElevenLabs agent
    const webhookUrl = `${supabaseUrl}/functions/v1/reminder-webhook?reminderId=${reminderId}`;
    const streamUrl = `wss://${new URL(supabaseUrl).hostname.replace('supabase.co', 'functions.supabase.co')}/functions/v1/elevenlabs-agent?agentId=${agentData.elevenlabs_agent_id}&callSid={{CallSid}}&reminderContext=${encodeURIComponent(reminderPrompt)}`;

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${streamUrl}">
      <Parameter name="reminderId" value="${reminderId}" />
      <Parameter name="appointmentId" value="${appointment.id}" />
    </Stream>
  </Connect>
</Response>`;

    // Create the outbound call
    const callResponse = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Calls.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: appointment.customer_phone,
          From: fromNumber,
          Twiml: twiml,
          StatusCallback: webhookUrl,
          StatusCallbackEvent: 'initiated ringing answered completed',
          StatusCallbackMethod: 'POST',
        }),
      }
    );

    if (!callResponse.ok) {
      const errorText = await callResponse.text();
      console.error('Twilio call creation failed:', errorText);
      
      // Update reminder as failed
      await supabase
        .from('appointment_reminders')
        .update({ 
          status: 'failed',
          notes: `Failed to initiate call: ${errorText}`
        })
        .eq('id', reminderId);

      return new Response(JSON.stringify({ error: 'Failed to initiate call' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const callData = await callResponse.json();
    console.log('Outbound call initiated:', callData.sid);

    // Update reminder with call SID
    await supabase
      .from('appointment_reminders')
      .update({ twilio_call_sid: callData.sid })
      .eq('id', reminderId);

    return new Response(JSON.stringify({
      success: true,
      callSid: callData.sid,
      message: 'Reminder call initiated'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in outbound-reminder-call:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: corsHeaders
    });
  }
});
