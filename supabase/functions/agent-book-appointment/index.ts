/**
 * Agent Book Appointment Endpoint
 *
 * Called by ElevenLabs agent to create appointments.
 * Validates availability, creates calendar event, and optionally syncs to Google Calendar.
 */

import { createServiceClient } from "../_shared/db.ts";
import { corsPreflightResponse, errorResponse, successResponse } from "../_shared/errors.ts";
import { createLogger } from "../_shared/logger.ts";
import {
  normalizePhone,
  formatAppointmentTime,
  checkProviderAvailability,
  findAvailableProvider,
  syncToGoogleCalendar,
  getOrganizationTimezone,
} from "../_shared/calendar-helpers.ts";

const logger = createLogger('agent-book-appointment');

interface BookAppointmentRequest {
  organization_id: string;
  customer_name: string;
  customer_phone: string;
  appointment_datetime: string;
  duration_minutes?: number;
  provider_id?: string;
  service_type?: string;
  notes?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return corsPreflightResponse();
  }

  try {
    const log = logger.withContext({ requestId: crypto.randomUUID() });

    const body: BookAppointmentRequest = await req.json();
    const {
      organization_id,
      customer_name,
      customer_phone,
      appointment_datetime,
      duration_minutes = 60,
      provider_id,
      service_type,
      notes,
    } = body;

    log.info("Book appointment request", { organization_id, customer_name, appointment_datetime });

    // Validate required fields
    if (!organization_id) {
      return errorResponse("Missing organization_id", 400);
    }

    if (!customer_name || !customer_phone || !appointment_datetime) {
      return successResponse({
        success: false,
        message: "I need the customer's name, phone number, and preferred appointment time to book an appointment.",
      });
    }

    const supabase = createServiceClient();

    // 1. Validate organization exists
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, timezone')
      .eq('id', organization_id)
      .single();

    if (orgError || !org) {
      log.warn("Invalid organization", { organization_id });
      return errorResponse("Invalid organization", 403);
    }

    const timezone = org.timezone || "America/New_York";

    // 2. Parse and validate datetime
    const startTime = new Date(appointment_datetime);
    const now = new Date();

    if (isNaN(startTime.getTime())) {
      return successResponse({
        success: false,
        message: "I couldn't understand that date and time. Could you please provide it in a clearer format?",
      });
    }

    if (startTime <= now) {
      return successResponse({
        success: false,
        message: "That time is in the past. Please provide a future date and time.",
      });
    }

    const endTime = new Date(startTime.getTime() + duration_minutes * 60 * 1000);

    // 3. Handle provider selection
    let selectedProvider: { id: string; name: string } | null = null;

    if (provider_id) {
      // Validate specified provider exists and is available
      const { data: provider } = await supabase
        .from('providers')
        .select('id, name, role')
        .eq('id', provider_id)
        .eq('organization_id', organization_id)
        .eq('is_active', true)
        .single();

      if (!provider) {
        return successResponse({
          success: false,
          message: "I couldn't find that provider. Would you like me to find someone else who's available?",
        });
      }

      const isAvailable = await checkProviderAvailability(supabase, provider_id, startTime, endTime);
      if (!isAvailable) {
        return successResponse({
          success: false,
          message: `${provider.name} isn't available at that time. Would you like me to find another available time or provider?`,
        });
      }

      selectedProvider = { id: provider.id, name: provider.name };
    } else {
      // Find any available provider
      const availableProvider = await findAvailableProvider(
        supabase,
        organization_id,
        startTime,
        endTime,
        service_type
      );

      if (availableProvider) {
        selectedProvider = { id: availableProvider.id, name: availableProvider.name };
      }
      // It's okay if no provider is found - we can still book without one
    }

    // 4. Check for conflicts in calendar_events (organization-wide if no provider)
    let conflictQuery = supabase
      .from('calendar_events')
      .select('id')
      .eq('organization_id', organization_id)
      .eq('status', 'confirmed')
      .lt('start_time', endTime.toISOString())
      .gt('end_time', startTime.toISOString());

    if (selectedProvider) {
      conflictQuery = conflictQuery.eq('provider_id', selectedProvider.id);
    }

    const { data: conflicts } = await conflictQuery.limit(1);

    if (conflicts && conflicts.length > 0) {
      return successResponse({
        success: false,
        message: "That time slot is no longer available. Would you like me to check for other available times?",
      });
    }

    // 5. Normalize phone number
    const normalizedPhone = normalizePhone(customer_phone);

    // 6. Create calendar event
    const eventTitle = service_type
      ? `${service_type}: ${customer_name}`
      : `Appointment: ${customer_name}`;

    const { data: calendarEvent, error: eventError } = await supabase
      .from('calendar_events')
      .insert({
        organization_id,
        provider_id: selectedProvider?.id || null,
        title: eventTitle,
        description: notes || null,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        status: 'confirmed',
        customer_name,
        customer_phone: normalizedPhone,
        source: 'native',
        sync_status: 'pending_push',
      })
      .select()
      .single();

    if (eventError) {
      log.error("Failed to create calendar event", eventError);
      return successResponse({
        success: false,
        message: "I had trouble booking the appointment. Please try again.",
      });
    }

    // 7. Create linked appointment record
    const { data: appointment, error: apptError } = await supabase
      .from('appointments')
      .insert({
        organization_id,
        provider_id: selectedProvider?.id || null,
        calendar_event_id: calendarEvent.id,
        customer_name,
        customer_phone: normalizedPhone,
        issue_description: service_type || 'General appointment',
        scheduled_start: startTime.toISOString(),
        scheduled_end: endTime.toISOString(),
        status: 'scheduled',
        notes,
      })
      .select('id')
      .single();

    if (apptError) {
      log.warn("Failed to create appointment record (non-fatal)", { error: apptError });
    }

    // 8. Update calendar event with appointment link
    if (appointment) {
      await supabase
        .from('calendar_events')
        .update({ appointment_id: appointment.id })
        .eq('id', calendarEvent.id);
    }

    // 9. Sync to Google Calendar (async, don't block response)
    syncToGoogleCalendar(supabase, organization_id, {
      id: calendarEvent.id,
      title: eventTitle,
      description: notes,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
    }, 'create').catch(err => {
      log.warn("Google Calendar sync failed", { error: err });
    });

    // 10. Also save/update contact
    await supabase
      .from('contacts')
      .upsert({
        organization_id,
        phone: normalizedPhone,
        name: customer_name,
        status: 'customer',
        source: 'inbound_call',
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'organization_id,phone',
        ignoreDuplicates: false,
      });

    // 11. Format confirmation message
    const formattedTime = formatAppointmentTime(startTime, timezone);
    let confirmationMessage = `I've booked your appointment for ${formattedTime}.`;

    if (selectedProvider) {
      confirmationMessage = `I've booked your appointment with ${selectedProvider.name} for ${formattedTime}.`;
    }

    log.info("Appointment booked successfully", {
      calendarEventId: calendarEvent.id,
      appointmentId: appointment?.id,
      provider: selectedProvider?.name,
    });

    return successResponse({
      success: true,
      appointment_id: calendarEvent.id,
      provider_name: selectedProvider?.name || null,
      message: confirmationMessage,
    });

  } catch (error) {
    logger.error("Handler error", error as Error);
    return successResponse({
      success: false,
      message: "I had trouble booking the appointment. Let me try again or transfer you to someone who can help.",
    });
  }
});
