/**
 * Send Lead Notification
 *
 * Sends SMS notification to escalation contacts when a new lead intake is logged.
 * For emergencies, sends immediately to all active contacts.
 * For non-emergencies, sends to the primary contact only.
 */

import { createServiceClient } from "../_shared/db.ts";
import { corsPreflightResponse, errorResponse, successResponse } from "../_shared/errors.ts";
import { createLogger } from "../_shared/logger.ts";
import { makeTwilioRequest, getTwilioCredentials } from "../_shared/twilio.ts";

const logger = createLogger('send-lead-notification');

interface SendNotificationRequest {
  institution_id: string;
  intake_id: string;
  is_emergency?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return corsPreflightResponse();
  }

  try {
    const log = logger.withContext({ requestId: crypto.randomUUID() });

    const body: SendNotificationRequest = await req.json();
    const { institution_id, intake_id, is_emergency = false } = body;

    log.info("Send notification request", { institution_id, intake_id, is_emergency });

    if (!institution_id || !intake_id) {
      return errorResponse("Missing required parameters", 400);
    }

    const supabase = createServiceClient();

    // Get intake details
    const { data: intake, error: intakeError } = await supabase
      .from('call_intakes')
      .select(`
        *,
        institutions:institution_id (
          name,
          notification_phone
        )
      `)
      .eq('id', intake_id)
      .eq('institution_id', institution_id)
      .single();

    if (intakeError || !intake) {
      log.error("Intake not found", { intake_id, error: intakeError });
      return errorResponse("Intake not found", 404);
    }

    // Get escalation contacts
    const { data: contacts, error: contactsError } = await supabase
      .from('escalation_contacts')
      .select('id, name, phone, role, priority')
      .eq('institution_id', institution_id)
      .eq('is_active', true)
      .order('priority', { ascending: true });

    if (contactsError) {
      log.error("Failed to fetch escalation contacts", contactsError);
      return errorResponse("Failed to fetch contacts", 500);
    }

    // Get institution's phone number for sending SMS
    const { data: phoneNumber } = await supabase
      .from('phone_numbers')
      .select('phone_number')
      .eq('institution_id', institution_id)
      .eq('is_active', true)
      .maybeSingle();

    if (!phoneNumber?.phone_number) {
      log.warn("No phone number available for sending SMS");
      return successResponse({
        success: false,
        message: "No phone number available for sending SMS",
        notifications_sent: 0,
      });
    }

    // Determine recipients
    // Emergency: all active contacts
    // Non-emergency: primary contact (priority 1) or fallback to notification_phone
    let recipients: { phone: string; name: string }[] = [];

    if (is_emergency && contacts && contacts.length > 0) {
      // Send to all active contacts for emergencies
      recipients = contacts.map(c => ({ phone: c.phone, name: c.name }));
    } else if (contacts && contacts.length > 0) {
      // Send to primary contact only for non-emergencies
      recipients = [{ phone: contacts[0].phone, name: contacts[0].name }];
    } else if (intake.institutions?.notification_phone) {
      // Fallback to institution notification phone
      recipients = [{ phone: intake.institutions.notification_phone, name: 'Office' }];
    }

    if (recipients.length === 0) {
      log.warn("No recipients available for notification");
      return successResponse({
        success: false,
        message: "No recipients configured",
        notifications_sent: 0,
      });
    }

    // Build SMS message
    const message = buildSmsMessage(intake, intake.institutions?.name || 'Unknown');

    // Send SMS to each recipient
    const results = await Promise.allSettled(
      recipients.map(recipient =>
        sendSms(phoneNumber.phone_number, recipient.phone, message, institution_id, supabase)
      )
    );

    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failedCount = results.filter(r => r.status === 'rejected').length;

    log.info("Notifications sent", {
      total: recipients.length,
      success: successCount,
      failed: failedCount,
    });

    return successResponse({
      success: true,
      message: `Sent ${successCount} notification(s)`,
      notifications_sent: successCount,
      notifications_failed: failedCount,
    });

  } catch (error) {
    logger.error("Handler error", error as Error);
    return errorResponse(error as Error);
  }
});

/**
 * Build SMS message based on intake data
 */
function buildSmsMessage(intake: any, orgName: string): string {
  const isEmergency = intake.is_emergency;
  const callerName = intake.caller_name || 'Unknown caller';
  const callerPhone = intake.caller_phone;
  const category = intake.service_category || 'general';
  const issue = intake.issue_description || 'No description provided';
  const urgency = intake.urgency || 'normal';

  // Truncate issue if too long
  const truncatedIssue = issue.length > 100 ? issue.substring(0, 100) + '...' : issue;

  if (isEmergency) {
    return `🚨 EMERGENCY - ${orgName}

${callerName} (${callerPhone})
Issue: ${truncatedIssue}
Category: ${category.toUpperCase()}

Call back immediately!`;
  }

  return `New lead - ${orgName}

${callerName} (${callerPhone})
Issue: ${truncatedIssue}
Category: ${category}
Urgency: ${urgency}`;
}

/**
 * Send SMS via Twilio
 */
async function sendSms(
  fromNumber: string,
  toNumber: string,
  message: string,
  institutionId: string,
  supabase: any
): Promise<{ success: boolean; sid?: string; error?: string }> {
  try {
    // Get institution's Twilio subaccount credentials
    const { data: institution } = await supabase
      .from('institutions')
      .select('twilio_subaccount_sid, twilio_subaccount_auth_token')
      .eq('id', institutionId)
      .single();

    let accountSid: string;
    let authToken: string;

    if (institution?.twilio_subaccount_sid && institution?.twilio_subaccount_auth_token) {
      // Use institution's subaccount
      accountSid = institution.twilio_subaccount_sid;
      authToken = institution.twilio_subaccount_auth_token;
    } else {
      // Fallback to main account
      const creds = getTwilioCredentials();
      accountSid = creds.accountSid;
      authToken = creds.authToken;
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

    const response = await makeTwilioRequest<{ sid: string }>(url, {
      accountSid,
      authToken,
      method: 'POST',
      body: {
        From: fromNumber,
        To: toNumber,
        Body: message,
      },
    });

    return { success: true, sid: response.sid };
  } catch (error) {
    const err = error as Error;
    console.error(`Failed to send SMS to ${toNumber}:`, err.message);
    return { success: false, error: err.message };
  }
}
