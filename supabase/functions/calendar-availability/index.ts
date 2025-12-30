/**
 * Calendar Availability Endpoint
 *
 * Called by ElevenLabs agent to check Google Calendar availability.
 * Returns available appointment slots based on business hours and existing events.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient } from "../_shared/db.ts";
import { corsPreflightResponse, errorResponse, successResponse } from "../_shared/errors.ts";
import { createLogger } from "../_shared/logger.ts";

const logger = createLogger('calendar-availability');

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

interface DaySchedule {
  enabled: boolean;
  start: string;
  end: string;
}

interface WeekSchedule {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

interface AvailableSlot {
  start: string;
  end: string;
  display: string;
}

interface CalendarEvent {
  start: string;
  end: string;
}

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

/**
 * Get valid access token, refreshing if necessary
 */
async function getValidAccessToken(supabase: any, organizationId: string): Promise<string | null> {
  const { data: connection, error } = await supabase
    .from("google_calendar_connections")
    .select("*")
    .eq("organization_id", organizationId)
    .single();

  if (error || !connection) {
    return null;
  }

  const expiresAt = new Date(connection.token_expires_at);
  const now = new Date();

  if (now >= expiresAt) {
    const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: connection.refresh_token,
        grant_type: "refresh_token",
      }),
    });

    const refreshData = await refreshResponse.json();

    if (refreshData.error) {
      return null;
    }

    const newExpiresAt = new Date(Date.now() + refreshData.expires_in * 1000).toISOString();
    await supabase
      .from("google_calendar_connections")
      .update({
        access_token: refreshData.access_token,
        token_expires_at: newExpiresAt,
      })
      .eq("organization_id", organizationId);

    return refreshData.access_token;
  }

  return connection.access_token;
}

/**
 * Get the selected calendar ID for the organization
 */
async function getSelectedCalendarId(supabase: any, organizationId: string): Promise<string> {
  const { data: connection } = await supabase
    .from("google_calendar_connections")
    .select("selected_calendars")
    .eq("organization_id", organizationId)
    .single();

  if (!connection?.selected_calendars?.length) {
    return "primary";
  }

  return connection.selected_calendars[0];
}

/**
 * Get business hours schedule for the organization
 */
async function getBusinessHours(supabase: any, organizationId: string): Promise<WeekSchedule | null> {
  const { data: org } = await supabase
    .from("organizations")
    .select("business_hours_schedule, timezone")
    .eq("id", organizationId)
    .single();

  return org?.business_hours_schedule as WeekSchedule | null;
}

/**
 * Get organization timezone
 */
async function getOrganizationTimezone(supabase: any, organizationId: string): Promise<string> {
  const { data: org } = await supabase
    .from("organizations")
    .select("timezone")
    .eq("id", organizationId)
    .single();

  return org?.timezone || "America/New_York";
}

/**
 * Fetch calendar events for a date range
 */
async function fetchCalendarEvents(
  accessToken: string,
  calendarId: string,
  timeMin: string,
  timeMax: string
): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
    timeMin,
    timeMax,
  });

  const eventsUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`;

  const response = await fetch(eventsUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    return [];
  }

  const data = await response.json();

  return (data.items || [])
    .filter((event: any) => event.start?.dateTime) // Only timed events, not all-day
    .map((event: any) => ({
      start: event.start.dateTime,
      end: event.end.dateTime,
    }));
}

/**
 * Parse time string (e.g., "09:00") to hours and minutes
 */
function parseTime(timeStr: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return { hours, minutes };
}

/**
 * Check if a time slot overlaps with any existing events
 */
function isSlotAvailable(slotStart: Date, slotEnd: Date, events: CalendarEvent[]): boolean {
  for (const event of events) {
    const eventStart = new Date(event.start);
    const eventEnd = new Date(event.end);

    // Check for overlap
    if (slotStart < eventEnd && slotEnd > eventStart) {
      return false;
    }
  }
  return true;
}

/**
 * Format a date for display (e.g., "Wednesday at 10 AM")
 */
function formatSlotDisplay(date: Date, timezone: string): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone,
  };

  return date.toLocaleString('en-US', options);
}

/**
 * Calculate date range based on preference
 */
function getDateRange(preference: string, timezone: string): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  switch (preference) {
    case 'today':
      // Start from next hour
      start.setMinutes(0, 0, 0);
      start.setHours(start.getHours() + 1);
      // End of today
      end.setHours(23, 59, 59, 999);
      break;

    case 'tomorrow':
      // Start of tomorrow
      start.setDate(start.getDate() + 1);
      start.setHours(0, 0, 0, 0);
      // End of tomorrow
      end.setDate(end.getDate() + 1);
      end.setHours(23, 59, 59, 999);
      break;

    case 'this_week':
      // Start from next hour
      start.setMinutes(0, 0, 0);
      start.setHours(start.getHours() + 1);
      // End of this week (Sunday)
      const daysUntilSunday = 7 - start.getDay();
      end.setDate(end.getDate() + daysUntilSunday);
      end.setHours(23, 59, 59, 999);
      break;

    case 'next_week':
    default:
      // Start from next hour
      start.setMinutes(0, 0, 0);
      start.setHours(start.getHours() + 1);
      // End in 14 days
      end.setDate(end.getDate() + 14);
      end.setHours(23, 59, 59, 999);
      break;
  }

  return { start, end };
}

/**
 * Find available slots within business hours
 */
function findAvailableSlots(
  startDate: Date,
  endDate: Date,
  businessHours: WeekSchedule | null,
  events: CalendarEvent[],
  durationMinutes: number,
  timezone: string,
  maxSlots: number = 5
): AvailableSlot[] {
  const slots: AvailableSlot[] = [];
  const current = new Date(startDate);

  // Default business hours if not set
  const defaultDaySchedule: DaySchedule = {
    enabled: true,
    start: "09:00",
    end: "17:00",
  };

  while (current <= endDate && slots.length < maxSlots) {
    const dayIndex = current.getDay();
    const dayName = DAY_NAMES[dayIndex];
    const daySchedule = businessHours?.[dayName] || defaultDaySchedule;

    if (daySchedule.enabled) {
      const { hours: startHour, minutes: startMin } = parseTime(daySchedule.start);
      const { hours: endHour, minutes: endMin } = parseTime(daySchedule.end);

      // Create slot start time
      const slotStart = new Date(current);
      slotStart.setHours(startHour, startMin, 0, 0);

      // Create day end time
      const dayEnd = new Date(current);
      dayEnd.setHours(endHour, endMin, 0, 0);

      // If we're on the first day and past start time, adjust
      if (slotStart < startDate) {
        // Round up to next hour
        slotStart.setTime(startDate.getTime());
        slotStart.setMinutes(0, 0, 0);
        slotStart.setHours(slotStart.getHours() + 1);
      }

      // Check each hour slot
      while (slotStart < dayEnd && slots.length < maxSlots) {
        const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60 * 1000);

        if (slotEnd <= dayEnd && isSlotAvailable(slotStart, slotEnd, events)) {
          slots.push({
            start: slotStart.toISOString(),
            end: slotEnd.toISOString(),
            display: formatSlotDisplay(slotStart, timezone),
          });
        }

        // Move to next hour
        slotStart.setHours(slotStart.getHours() + 1);
      }
    }

    // Move to next day
    current.setDate(current.getDate() + 1);
    current.setHours(0, 0, 0, 0);
  }

  return slots;
}

/**
 * Format business hours for display
 */
function formatBusinessHours(businessHours: WeekSchedule | null): string {
  if (!businessHours) {
    return "9 AM - 5 PM weekdays";
  }

  // Check if all weekdays have same hours
  const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const;
  const weekdaySchedules = weekdays.map(d => businessHours[d]);

  const allSame = weekdaySchedules.every(
    s => s.enabled === weekdaySchedules[0].enabled &&
         s.start === weekdaySchedules[0].start &&
         s.end === weekdaySchedules[0].end
  );

  if (allSame && weekdaySchedules[0].enabled) {
    const { hours: startH } = parseTime(weekdaySchedules[0].start);
    const { hours: endH } = parseTime(weekdaySchedules[0].end);
    const startAmPm = startH >= 12 ? 'PM' : 'AM';
    const endAmPm = endH >= 12 ? 'PM' : 'AM';
    const startDisplay = startH > 12 ? startH - 12 : startH;
    const endDisplay = endH > 12 ? endH - 12 : endH;
    return `${startDisplay} ${startAmPm} - ${endDisplay} ${endAmPm} weekdays`;
  }

  return "Variable hours - check specific days";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return corsPreflightResponse();
  }

  try {
    const log = logger.withContext({ requestId: crypto.randomUUID() });

    // Parse request body - ElevenLabs sends tool parameters here
    const body = await req.json();

    // ElevenLabs may send organization_id as a parameter, or we may need to get it from headers
    const organizationId = body.organization_id;
    const datePreference = body.date_preference || 'this_week';
    const durationMinutes = body.duration_minutes || 60;

    log.info("Availability check requested", { organizationId, datePreference, durationMinutes });

    if (!organizationId) {
      return successResponse({
        error: "Organization ID required",
        available_slots: [],
        next_available: "Unable to check calendar - missing organization",
        business_hours: "Unknown",
      });
    }

    const supabase = createServiceClient();

    // Get Google Calendar access token
    const accessToken = await getValidAccessToken(supabase, organizationId);
    if (!accessToken) {
      log.warn("No Google Calendar connection", { organizationId });
      return successResponse({
        error: "Calendar not connected",
        available_slots: [],
        next_available: "Calendar is not connected. Please ask the customer for their preferred time.",
        business_hours: "Unknown",
      });
    }

    // Get calendar ID and business hours
    const [calendarId, businessHours, timezone] = await Promise.all([
      getSelectedCalendarId(supabase, organizationId),
      getBusinessHours(supabase, organizationId),
      getOrganizationTimezone(supabase, organizationId),
    ]);

    // Calculate date range
    const { start, end } = getDateRange(datePreference, timezone);

    log.info("Fetching events", { calendarId, start: start.toISOString(), end: end.toISOString() });

    // Fetch existing calendar events
    const events = await fetchCalendarEvents(
      accessToken,
      calendarId,
      start.toISOString(),
      end.toISOString()
    );

    log.info("Events fetched", { count: events.length });

    // Find available slots
    const availableSlots = findAvailableSlots(
      start,
      end,
      businessHours,
      events,
      durationMinutes,
      timezone
    );

    log.info("Available slots found", { count: availableSlots.length });

    const response = {
      available_slots: availableSlots,
      next_available: availableSlots.length > 0
        ? availableSlots[0].display
        : "No available slots in the requested time period",
      business_hours: formatBusinessHours(businessHours),
    };

    return successResponse(response);

  } catch (error) {
    logger.error("Handler error", error as Error);
    return successResponse({
      error: "Failed to check availability",
      available_slots: [],
      next_available: "Unable to check calendar at this time",
      business_hours: "Unknown",
    });
  }
});
