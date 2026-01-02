/**
 * Agent Reschedule Appointment Endpoint
 *
 * Called by ElevenLabs agent to reschedule appointments.
 * Validates new slot is available before updating.
 */

import { createServiceClient } from "../_shared/db.ts";
import { corsPreflightResponse, errorResponse, successResponse } from "../_shared/errors.ts";
import { createLogger } from "../_shared/logger.ts";
import {
  getPhoneVariants,
  formatAppointmentTime,
  formatAppointmentTimeShort,
  checkProviderAvailability,
  syncToGoogleCalendar,
  getOrganizationTimezone,
} from "../_shared/calendar-helpers.ts";

const logger = createLogger('agent-reschedule-appointment');

interface RescheduleAppointmentRequest {
  organization_id: string;
  customer_phone: string;
  current_appointment_datetime?: string;
  new_datetime: string;
  new_duration_minutes?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return corsPreflightResponse();
  }

  try {
    const log = logger.withContext({ requestId: crypto.randomUUID() });

    const body: RescheduleAppointmentRequest = await req.json();
    const {
      organization_id,
      customer_phone,
      current_appointment_datetime,
      new_datetime,
      new_duration_minutes,
    } = body;

    log.info("Reschedule appointment request", { organization_id, customer_phone, new_datetime });

    // Validate required fields
    if (!organization_id) {
      return errorResponse("Missing organization_id", 400);
    }

    if (!customer_phone || !new_datetime) {
      return successResponse({
        success: false,
        message: "I need the customer's phone number and the new preferred time to reschedule the appointment.",
      });
    }

    const supabase = createServiceClient();

    // Get organization timezone
    const timezone = await getOrganizationTimezone(supabase, organization_id);

    // Get phone variants for flexible matching
    const phoneVariants = getPhoneVariants(customer_phone);

    // 1. Find existing appointment(s)
    const now = new Date().toISOString();

    let query = supabase
      .from('calendar_events')
      .select('id, title, start_time, end_time, customer_name, provider_id, external_id, description')
      .eq('organization_id', organization_id)
      .eq('status', 'confirmed')
      .in('customer_phone', phoneVariants)
      .gt('start_time', now)
      .order('start_time', { ascending: true });

    if (current_appointment_datetime) {
      const targetTime = new Date(current_appointment_datetime);
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
        message: "I couldn't find an upcoming appointment for that phone number. Could you confirm the details?",
      });
    }

    // Handle multiple appointments
    if (appointments.length > 1 && !current_appointment_datetime) {
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
        message: `I see multiple upcoming appointments: ${appointmentList}. Which one would you like to reschedule?`,
      });
    }

    const existingAppointment = appointments[0];

    // 2. Validate new datetime
    const newStartTime = new Date(new_datetime);

    if (isNaN(newStartTime.getTime())) {
      return successResponse({
        success: false,
        message: "I couldn't understand that date and time. Could you please provide it in a clearer format?",
      });
    }

    if (newStartTime <= new Date()) {
      return successResponse({
        success: false,
        message: "The new time is in the past. Please provide a future date and time.",
      });
    }

    // Calculate duration from existing appointment or use provided
    const existingDuration = (new Date(existingAppointment.end_time).getTime() -
      new Date(existingAppointment.start_time).getTime()) / 60000;
    const duration = new_duration_minutes || existingDuration;
    const newEndTime = new Date(newStartTime.getTime() + duration * 60 * 1000);

    // 3. Check provider availability for new time (if provider assigned)
    if (existingAppointment.provider_id) {
      const isAvailable = await checkProviderAvailability(
        supabase,
        existingAppointment.provider_id,
        newStartTime,
        newEndTime
      );

      if (!isAvailable) {
        return successResponse({
          success: false,
          message: "That provider isn't available at the new time. Would you like me to check other available times?",
        });
      }
    }

    // 4. Check for conflicts (excluding the current appointment)
    let conflictQuery = supabase
      .from('calendar_events')
      .select('id')
      .eq('organization_id', organization_id)
      .eq('status', 'confirmed')
      .neq('id', existingAppointment.id)
      .lt('start_time', newEndTime.toISOString())
      .gt('end_time', newStartTime.toISOString());

    if (existingAppointment.provider_id) {
      conflictQuery = conflictQuery.eq('provider_id', existingAppointment.provider_id);
    }

    const { data: conflicts } = await conflictQuery.limit(1);

    if (conflicts && conflicts.length > 0) {
      return successResponse({
        success: false,
        message: "That time slot is not available. Would you like me to check for other times?",
      });
    }

    // 5. Update the appointment
    const { error: updateError } = await supabase
      .from('calendar_events')
      .update({
        start_time: newStartTime.toISOString(),
        end_time: newEndTime.toISOString(),
        updated_at: new Date().toISOString(),
        sync_status: 'pending_push',
      })
      .eq('id', existingAppointment.id);

    if (updateError) {
      log.error("Failed to reschedule appointment", updateError);
      return successResponse({
        success: false,
        message: "I had trouble rescheduling the appointment. Please try again.",
      });
    }

    // Update linked appointments table record
    await supabase
      .from('appointments')
      .update({
        scheduled_start: newStartTime.toISOString(),
        scheduled_end: newEndTime.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('calendar_event_id', existingAppointment.id);

    // 6. Sync to Google Calendar
    if (existingAppointment.external_id) {
      syncToGoogleCalendar(supabase, organization_id, {
        id: existingAppointment.id,
        title: existingAppointment.title,
        description: existingAppointment.description,
        start_time: newStartTime.toISOString(),
        end_time: newEndTime.toISOString(),
        external_id: existingAppointment.external_id,
      }, 'update').catch(err => {
        log.warn("Google Calendar sync failed", { error: err });
      });
    }

    const oldTime = formatAppointmentTimeShort(new Date(existingAppointment.start_time), timezone);
    const newTime = formatAppointmentTime(newStartTime, timezone);

    log.info("Appointment rescheduled", {
      appointmentId: existingAppointment.id,
      oldTime: existingAppointment.start_time,
      newTime: newStartTime.toISOString(),
    });

    return successResponse({
      success: true,
      appointment_id: existingAppointment.id,
      message: `I've rescheduled your appointment from ${oldTime} to ${newTime}. Is there anything else I can help you with?`,
    });

  } catch (error) {
    logger.error("Handler error", error as Error);
    return successResponse({
      success: false,
      message: "I had trouble rescheduling the appointment. Let me transfer you to someone who can help.",
    });
  }
});
