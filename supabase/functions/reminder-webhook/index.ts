import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient } from "../_shared/db.ts";
import { corsHeaders } from "../_shared/errors.ts";
import { createLogger } from "../_shared/logger.ts";

const logger = createLogger('reminder-webhook');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const log = logger.withContext({ requestId: crypto.randomUUID() });
    const supabase = createServiceClient();

    const url = new URL(req.url);
    const reminderId = url.searchParams.get('reminderId');

    if (!reminderId) {
      log.warn('Missing reminderId parameter');
      return new Response('OK', { status: 200 });
    }

    // Parse Twilio webhook data
    const formData = await req.formData();
    const callStatus = formData.get('CallStatus') as string;
    const callDuration = formData.get('CallDuration') as string;
    const callSid = formData.get('CallSid') as string;

    log.info('Reminder webhook received', { reminderId, status: callStatus, duration: callDuration });

    // Get reminder and appointment details
    const { data: reminder, error: reminderError } = await supabase
      .from('appointment_reminders')
      .select('*, appointments(*)')
      .eq('id', reminderId)
      .single();

    if (reminderError || !reminder) {
      log.error('Reminder not found', reminderError || new Error('No reminder data'));
      return new Response('OK', { status: 200 });
    }

    // Handle different call statuses
    if (callStatus === 'completed') {
      const outcome = await analyzeCallOutcome(supabase, callSid, reminder, log);

      await supabase
        .from('appointment_reminders')
        .update({
          status: 'completed',
          response: outcome,
          call_duration_seconds: parseInt(callDuration) || 0,
        })
        .eq('id', reminderId);

      // Update appointment status based on response
      if (outcome === 'confirmed') {
        await supabase
          .from('appointments')
          .update({ status: 'confirmed' })
          .eq('id', reminder.appointments.id);
      } else if (outcome === 'declined') {
        await supabase
          .from('appointments')
          .update({ status: 'cancelled' })
          .eq('id', reminder.appointments.id);
      }

      // Notify organization
      await notifyOrganization(supabase, reminder, outcome, log);

      // If reschedule requested, create a follow-up task
      if (outcome === 'reschedule_requested') {
        await createRescheduleTask(supabase, reminder, log);
      }

    } else if (callStatus === 'no-answer' || callStatus === 'busy' || callStatus === 'failed') {
      await supabase
        .from('appointment_reminders')
        .update({
          status: 'completed',
          response: 'no_answer',
          notes: `Call status: ${callStatus}`,
        })
        .eq('id', reminderId);

    } else if (callStatus === 'canceled') {
      await supabase
        .from('appointment_reminders')
        .update({ status: 'cancelled' })
        .eq('id', reminderId);
    }

    return new Response('OK', { status: 200 });

  } catch (error) {
    logger.error('Handler error', error as Error);
    return new Response('OK', { status: 200 });
  }
});

async function analyzeCallOutcome(
  supabase: any,
  callSid: string,
  reminder: any,
  log: any
): Promise<'confirmed' | 'declined' | 'reschedule_requested' | 'no_answer'> {
  // Try to get call transcripts if available
  const { data: transcripts } = await supabase
    .from('call_transcripts')
    .select('content, speaker')
    .eq('call_id', callSid)
    .order('created_at', { ascending: true });

  if (!transcripts || transcripts.length === 0) {
    return 'no_answer';
  }

  const conversation = transcripts
    .map((t: any) => `${t.speaker}: ${t.content}`)
    .join('\n');

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      log.info('No LOVABLE_API_KEY, defaulting to confirmed');
      return 'confirmed';
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are analyzing a phone call transcript for an appointment reminder.
Determine the customer's response. Return ONLY one of these exact words:
- confirmed (customer confirmed the appointment)
- declined (customer wants to cancel)
- reschedule_requested (customer wants to reschedule)
- no_answer (unclear or no clear response)`
          },
          {
            role: 'user',
            content: `Analyze this call transcript and determine the outcome:\n\n${conversation}`
          }
        ],
        temperature: 0.1,
        max_tokens: 50,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const result = data.choices?.[0]?.message?.content?.toLowerCase().trim();

      if (['confirmed', 'declined', 'reschedule_requested', 'no_answer'].includes(result)) {
        return result as any;
      }
    }
  } catch (error) {
    log.error('Error analyzing call outcome', error as Error);
  }

  return 'confirmed';
}

async function notifyOrganization(supabase: any, reminder: any, outcome: string, log: any) {
  const { data: orgData } = await supabase
    .from('organizations')
    .select('notification_email, notification_phone, name')
    .eq('id', reminder.organization_id)
    .single();

  if (!orgData) return;

  const appointment = reminder.appointments;
  const appointmentDate = new Date(appointment.scheduled_start);
  const formattedDate = appointmentDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });

  const outcomeMessages: Record<string, string> = {
    confirmed: `CONFIRMED: ${appointment.customer_name} confirmed their appointment for ${formattedDate}`,
    declined: `CANCELLED: ${appointment.customer_name} cancelled their appointment for ${formattedDate}`,
    reschedule_requested: `RESCHEDULE: ${appointment.customer_name} requested to reschedule their appointment for ${formattedDate}`,
    no_answer: `NO ANSWER: Could not reach ${appointment.customer_name} for their appointment on ${formattedDate}`,
  };

  const message = outcomeMessages[outcome] || `Reminder call completed for ${appointment.customer_name}`;

  if (orgData.notification_email) {
    try {
      const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
      if (RESEND_API_KEY) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'AnswerAfter <notifications@answerafter.com>',
            to: orgData.notification_email,
            subject: `Appointment Reminder: ${appointment.customer_name} - ${outcome.toUpperCase()}`,
            html: `
              <h2>Appointment Reminder Update</h2>
              <p>${message}</p>
              <hr>
              <p><strong>Customer:</strong> ${appointment.customer_name}</p>
              <p><strong>Phone:</strong> ${appointment.customer_phone}</p>
              <p><strong>Service:</strong> ${appointment.issue_description}</p>
              <p><strong>Scheduled:</strong> ${formattedDate}</p>
            `,
          }),
        });
        log.info('Email notification sent', { to: orgData.notification_email });
      }
    } catch (error) {
      log.error('Error sending email notification', error as Error);
    }
  }

  log.info('Organization notified', { orgName: orgData.name, message });
}

async function createRescheduleTask(supabase: any, reminder: any, log: any) {
  log.info('Reschedule requested', { appointmentId: reminder.appointments.id });

  await supabase
    .from('appointments')
    .update({
      notes: `[${new Date().toISOString()}] Customer requested reschedule during reminder call. Please contact to arrange new time.`
    })
    .eq('id', reminder.appointments.id);
}
