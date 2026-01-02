/**
 * Agent Log Intake Endpoint
 *
 * Called by ElevenLabs workflow to log structured intake data from lead recovery calls.
 * Creates a call_intakes record and optionally triggers SMS notification.
 */

import { createServiceClient } from "../_shared/db.ts";
import { corsPreflightResponse, errorResponse, successResponse } from "../_shared/errors.ts";
import { createLogger } from "../_shared/logger.ts";

const logger = createLogger('agent-log-intake');

interface LogIntakeRequest {
  institution_id: string;
  caller_name?: string;
  caller_phone: string;
  caller_address?: string;
  caller_zip?: string;
  service_category?: string;
  issue_description: string;
  urgency?: string;
  is_emergency?: boolean;
  emergency_keywords?: string[];
  call_sid?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return corsPreflightResponse();
  }

  try {
    const log = logger.withContext({ requestId: crypto.randomUUID() });

    const body: LogIntakeRequest = await req.json();
    const {
      institution_id,
      caller_name,
      caller_phone,
      caller_address,
      caller_zip,
      service_category,
      issue_description,
      urgency = 'normal',
      is_emergency = false,
      emergency_keywords = [],
      call_sid,
    } = body;

    log.info("Log intake request", {
      institution_id,
      caller_phone,
      service_category,
      urgency,
      is_emergency,
    });

    // SECURITY: institution_id comes from webhook config, not agent input
    if (!institution_id) {
      log.warn("Missing institution_id in request");
      return errorResponse("Missing institution_id", 400);
    }

    if (!caller_phone) {
      log.warn("Missing caller phone number");
      return errorResponse("Caller phone number is required", 400);
    }

    if (!issue_description) {
      log.warn("Missing issue description");
      return errorResponse("Issue description is required", 400);
    }

    const supabase = createServiceClient();

    // Validate institution exists
    const { data: org, error: orgError } = await supabase
      .from('institutions')
      .select('id, name, workflow_config')
      .eq('id', institution_id)
      .single();

    if (orgError || !org) {
      log.warn("Invalid institution", { institution_id });
      return errorResponse("Invalid institution", 403);
    }

    // Normalize phone number
    const normalizedPhone = normalizePhone(caller_phone);

    // Upsert contact as lead
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .upsert({
        institution_id,
        phone: normalizedPhone,
        name: caller_name || null,
        address: caller_address || null,
        status: 'lead',
        source: 'inbound_call',
        interest_level: is_emergency ? 'hot' : urgency === 'high' ? 'hot' : 'warm',
        lead_status: 'new',
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'institution_id,phone',
        ignoreDuplicates: false
      })
      .select('id')
      .single();

    if (contactError) {
      log.error("Failed to upsert contact", contactError);
      // Continue anyway - intake is more important
    }

    // Find call record by call_sid if provided
    let callId: string | null = null;
    if (call_sid) {
      const { data: call } = await supabase
        .from('calls')
        .select('id')
        .eq('twilio_call_sid', call_sid)
        .maybeSingle();
      callId = call?.id || null;
    }

    // Create intake record
    const { data: intake, error: intakeError } = await supabase
      .from('call_intakes')
      .insert({
        institution_id,
        call_id: callId,
        contact_id: contact?.id || null,
        caller_name: caller_name || null,
        caller_phone: normalizedPhone,
        caller_address: caller_address || null,
        caller_zip: caller_zip || null,
        service_category: validateCategory(service_category),
        issue_description,
        urgency: validateUrgency(urgency),
        is_emergency,
        emergency_keywords: emergency_keywords.length > 0 ? emergency_keywords : null,
        callback_requested: !is_emergency,  // Non-emergencies get callbacks
      })
      .select('id')
      .single();

    if (intakeError) {
      log.error("Failed to create intake", intakeError);
      return errorResponse("Failed to log intake: " + intakeError.message, 500);
    }

    // Update call record with intake link
    if (callId) {
      await supabase
        .from('calls')
        .update({
          intake_id: intake.id,
          is_emergency,
        })
        .eq('id', callId);
    }

    log.info("Intake logged successfully", {
      intakeId: intake.id,
      contactId: contact?.id,
      isEmergency: is_emergency,
    });

    // Trigger lead notification (async, don't wait)
    triggerLeadNotification(supabase, institution_id, intake.id, is_emergency).catch(err => {
      log.error("Failed to trigger notification", err as Error);
    });

    // Return confirmation message for agent to speak
    const workflowConfig = org.workflow_config || {};
    const callbackHours = workflowConfig.callback_hours_offset || 2;

    const callbackMessage = is_emergency
      ? "I've noted the emergency. Connecting you now."
      : `I've recorded your information. A technician will call you back within ${callbackHours} hours.`;

    return successResponse({
      success: true,
      intake_id: intake.id,
      contact_id: contact?.id,
      message: callbackMessage,
      callback_requested: !is_emergency,
      callback_hours: callbackHours,
    });

  } catch (error) {
    logger.error("Handler error", error as Error);
    return errorResponse(error as Error);
  }
});

/**
 * Normalize phone number to consistent format
 */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  return phone.startsWith('+') ? phone : `+${digits}`;
}

/**
 * Validate service category against allowed values
 */
function validateCategory(category?: string): string | null {
  const validCategories = [
    'hvac', 'plumbing', 'electrical', 'roofing',
    'appliance', 'locksmith', 'pest_control', 'general'
  ];

  if (!category) return null;

  const normalized = category.toLowerCase().trim();
  return validCategories.includes(normalized) ? normalized : 'general';
}

/**
 * Validate urgency against allowed values
 */
function validateUrgency(urgency?: string): string {
  const validUrgencies = ['low', 'normal', 'high', 'emergency'];

  if (!urgency) return 'normal';

  const normalized = urgency.toLowerCase().trim();
  return validUrgencies.includes(normalized) ? normalized : 'normal';
}

/**
 * Trigger lead notification (async)
 */
async function triggerLeadNotification(
  supabase: any,
  institutionId: string,
  intakeId: string,
  isEmergency: boolean
): Promise<void> {
  try {
    // Call send-lead-notification function
    const { error } = await supabase.functions.invoke('send-lead-notification', {
      body: {
        institution_id: institutionId,
        intake_id: intakeId,
        is_emergency: isEmergency
      }
    });

    if (error) {
      console.error(`[Lead Notification] Failed to send notification:`, error);
    } else {
      console.log(`[Lead Notification] Notification triggered for intake ${intakeId}, emergency: ${isEmergency}`);
    }
  } catch (err) {
    console.error(`[Lead Notification] Error invoking function:`, err);
  }
}
