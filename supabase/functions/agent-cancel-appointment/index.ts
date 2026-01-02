/**
 * Agent Cancel Appointment Endpoint
 *
 * Called by ElevenLabs agent to cancel appointments.
 * Looks up by customer phone and cancels the next upcoming appointment.
 */

import { createServiceClient } from "../_shared/db.ts";
import { corsPreflightResponse, errorResponse, successResponse } from "../_shared/errors.ts";
import { createLogger } from "../_shared/logger.ts";
import {
  getPhoneVariants,
  formatAppointmentTime,
  formatAppointmentTimeShort,
  syncToGoogleCalendar,
  getOrganizationTimezone,
} from "../_shared/calendar-helpers.ts";

const logger = createLogger('agent-cancel-appointment');

interface CancelAppointmentRequest {
  organization_id: string;
  customer_phone: string;
  appointment_datetime?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return corsPreflightResponse();
  }

  try {
    const log = logger.withContext({ requestId: crypto.randomUUID() });

    const body: CancelAppointmentRequest = await req.json();
    const { organization_id, customer_phone, appointment_datetime } = body;

    log.info("Cancel appointment request", { organization_id, customer_phone });

    // Validate required fields
    if (!organization_id) {
      return errorResponse("Missing organization_id", 400);
    }

    if (!customer_phone) {
      return successResponse({
        success: false,
        message: "I need the customer's phone number to look up their appointment.",
      });
    }

    const supabase = createServiceClient();

    // Get organization timezone
    const timezone = await getOrganizationTimezone(supabase, organization_id);

    // Get phone variants for flexible matching
    const phoneVariants = getPhoneVariants(customer_phone);

    // Find upcoming appointments for this customer
    const now = new Date().toISOString();

    let query = supabase
      .from('calendar_events')
      .select('id, title, start_time, end_time, customer_name, status, external_id, provider_id')
      .eq('organization_id', organization_id)
      .eq('status', 'confirmed')
      .in('customer_phone', phoneVariants)
      .gt('start_time', now)
      .order('start_time', { ascending: true });

    // If specific datetime provided, narrow the search
    if (appointment_datetime) {
      const targetTime = new Date(appointment_datetime);
      // Allow a small window around the specified time (30 minutes)
      const windowStart = new Date(targetTime.getTime() - 30 * 60 * 1000);
      const windowEnd = new Date(targetTime.getTime() + 30 * 60 * 1000);
      query = query
        .gte('start_time', windowStart.toISOString())
        .lte('start_time', windowEnd.toISOString());
    }

    const { data: appointments, error: lookupError } = await query;

    if (lookupError) {
      log.error("Error looking up appointments", lookupError);
      return successResponse({
        success: false,
        message: "I had trouble looking up the appointment. Let me try again.",
      });
    }

    if (!appointments || appointments.length === 0) {
      return successResponse({
        success: false,
        message: "I don't see any upcoming appointments for that phone number. Could you confirm the phone number or the date of the appointment?",
      });
    }

    // If multiple appointments and no specific datetime provided, ask for clarification
    if (appointments.length > 1 && !appointment_datetime) {
      const appointmentList = appointments.slice(0, 3).map(apt => {
        return formatAppointmentTimeShort(new Date(apt.start_time), timezone);
      }).join(', ');

      return successResponse({
        success: false,
        multiple_appointments: true,
        appointments: appointments.slice(0, 5).map(apt => ({
          id: apt.id,
          datetime: apt.start_time,
          display: formatAppointmentTimeShort(new Date(apt.start_time), timezone),
        })),
        message: `I see multiple upcoming appointments: ${appointmentList}. Which one would you like to cancel?`,
      });
    }

    // Cancel the appointment
    const appointmentToCancel = appointments[0];

    const { error: updateError } = await supabase
      .from('calendar_events')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', appointmentToCancel.id);

    if (updateError) {
      log.error("Failed to cancel appointment", updateError);
      return successResponse({
        success: false,
        message: "I had trouble cancelling the appointment. Please try again.",
      });
    }

    // Also update the linked appointments table record
    await supabase
      .from('appointments')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('calendar_event_id', appointmentToCancel.id);

    // Sync cancellation to Google Calendar
    if (appointmentToCancel.external_id) {
      syncToGoogleCalendar(supabase, organization_id, {
        id: appointmentToCancel.id,
        title: appointmentToCancel.title,
        start_time: appointmentToCancel.start_time,
        end_time: appointmentToCancel.end_time,
        external_id: appointmentToCancel.external_id,
      }, 'cancel').catch(err => {
        log.warn("Google Calendar sync failed", { error: err });
      });
    }

    const cancelledTime = formatAppointmentTime(new Date(appointmentToCancel.start_time), timezone);

    log.info("Appointment cancelled", { appointmentId: appointmentToCancel.id });

    return successResponse({
      success: true,
      cancelled_appointment_id: appointmentToCancel.id,
      message: `I've cancelled your appointment for ${cancelledTime}. Is there anything else I can help you with?`,
    });

  } catch (error) {
    logger.error("Handler error", error as Error);
    return successResponse({
      success: false,
      message: "I had trouble cancelling the appointment. Let me transfer you to someone who can help.",
    });
  }
});
