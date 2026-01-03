import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient } from "../_shared/db.ts";
import { corsPreflightResponse, errorResponse, successResponse } from "../_shared/errors.ts";
import { createLogger } from "../_shared/logger.ts";
import { parseJsonBody } from "../_shared/validation.ts";

const logger = createLogger('outbound-reminder-call');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return corsPreflightResponse();
  }

  try {
    const log = logger.withContext({ requestId: crypto.randomUUID() });
    const supabase = createServiceClient();

    const body = await parseJsonBody<{
      reminderId?: string;
      appointmentId?: string;
    }>(req, []);

    const { reminderId, appointmentId } = body;

    if (!reminderId && !appointmentId) {
      return errorResponse('reminderId or appointmentId required', 400);
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
        log.error('Reminder not found', error || new Error('No data'));
        return errorResponse('Reminder not found', 404);
      }
      reminder = data;
    }

    const appointment = reminder.appointments;
    if (!appointment) {
      return errorResponse('Appointment not found', 404);
    }

    log.info('Processing reminder', { reminderId, appointmentId: appointment.id });

    // Get organization details
    const { data: orgData, error: orgError } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', reminder.account_id)
      .single();

    if (orgError || !orgData) {
      log.error('Institution not found', orgError || new Error('No data'));
      return errorResponse('Institution not found', 404);
    }

    // Get organization's phone number
    const { data: phoneData } = await supabase
      .from('phone_numbers')
      .select('phone_number')
      .eq('account_id', reminder.account_id)
      .eq('is_active', true)
      .limit(1)
      .single();

    const fromNumber = phoneData?.phone_number || Deno.env.get('TWILIO_DEFAULT_FROM_NUMBER');
    if (!fromNumber) {
      return errorResponse('No phone number configured', 400);
    }

    // Get ElevenLabs agent for this account
    const { data: agentData } = await supabase
      .from('account_agents')
      .select('elevenlabs_agent_id')
      .eq('account_id', reminder.account_id)
      .single();

    if (!agentData?.elevenlabs_agent_id) {
      return errorResponse('No AI agent configured for organization', 400);
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;

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
      log.error('Twilio call creation failed', new Error(errorText));

      await supabase
        .from('appointment_reminders')
        .update({
          status: 'failed',
          notes: `Failed to initiate call: ${errorText}`
        })
        .eq('id', reminderId);

      return errorResponse('Failed to initiate call', 500);
    }

    const callData = await callResponse.json();
    log.info('Outbound call initiated', { callSid: callData.sid });

    // Update reminder with call SID
    await supabase
      .from('appointment_reminders')
      .update({ twilio_call_sid: callData.sid })
      .eq('id', reminderId);

    return successResponse({
      success: true,
      callSid: callData.sid,
      message: 'Reminder call initiated'
    });

  } catch (error) {
    logger.error('Handler error', error as Error);
    return errorResponse('Internal server error', 500);
  }
});
