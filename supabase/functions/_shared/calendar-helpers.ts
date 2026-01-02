/**
 * Shared Calendar Helpers
 *
 * Utility functions for appointment management endpoints:
 * - agent-book-appointment
 * - agent-cancel-appointment
 * - agent-reschedule-appointment
 */

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

/**
 * Normalize phone number to consistent format (+1XXXXXXXXXX)
 */
export function normalizePhone(phone: string): string {
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
 * Get phone number variants for flexible lookup
 * Returns multiple formats that might match the same number
 */
export function getPhoneVariants(phone: string): string[] {
  const digits = phone.replace(/\D/g, '');
  const variants: string[] = [phone];

  if (digits.length === 10) {
    variants.push(`+1${digits}`, `1${digits}`, digits);
  } else if (digits.length === 11 && digits.startsWith('1')) {
    variants.push(`+${digits}`, digits, digits.slice(1), `+1${digits.slice(1)}`);
  }

  return [...new Set(variants)];
}

/**
 * Format appointment time for spoken output
 * e.g., "Wednesday, January 15th at 10:00 AM"
 */
export function formatAppointmentTime(date: Date, timezone: string): string {
  return date.toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone,
  });
}

/**
 * Get a short display format for appointment time
 * e.g., "Wed Jan 15 at 10 AM"
 */
export function formatAppointmentTimeShort(date: Date, timezone: string): string {
  return date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone,
  });
}

/**
 * Check if a specific provider is available at a given time
 * Considers: provider schedules, overrides, and existing calendar events
 */
export async function checkProviderAvailability(
  supabase: any,
  providerId: string,
  startTime: Date,
  endTime: Date
): Promise<boolean> {
  const dayOfWeek = startTime.getDay();
  const startTimeStr = startTime.toTimeString().slice(0, 5); // "HH:MM"
  const endTimeStr = endTime.toTimeString().slice(0, 5);
  const dateStr = startTime.toISOString().split('T')[0];

  // 1. Check provider schedule for this day of week
  const { data: schedule } = await supabase
    .from('provider_schedules')
    .select('*')
    .eq('provider_id', providerId)
    .eq('day_of_week', dayOfWeek)
    .eq('is_available', true)
    .lte('start_time', startTimeStr)
    .gte('end_time', endTimeStr)
    .maybeSingle();

  // No schedule for this day/time = not available
  if (!schedule) {
    return false;
  }

  // 2. Check for date-specific overrides (vacations, blocked time)
  const { data: override } = await supabase
    .from('provider_schedule_overrides')
    .select('*')
    .eq('provider_id', providerId)
    .eq('override_date', dateStr)
    .maybeSingle();

  // If there's an override marking as unavailable, not available
  if (override && !override.is_available) {
    // Check if the override covers this time slot
    if (!override.start_time || !override.end_time) {
      // Entire day is blocked
      return false;
    }
    // Check if time overlaps with blocked period
    if (startTimeStr < override.end_time && endTimeStr > override.start_time) {
      return false;
    }
  }

  // 3. Check for existing calendar events (conflicts)
  const { data: conflicts } = await supabase
    .from('calendar_events')
    .select('id')
    .eq('provider_id', providerId)
    .eq('status', 'confirmed')
    .lt('start_time', endTime.toISOString())
    .gt('end_time', startTime.toISOString())
    .limit(1);

  // If any conflicts exist, not available
  return !conflicts || conflicts.length === 0;
}

/**
 * Find any available provider for a time slot
 * Optionally filter by service type/role
 */
export async function findAvailableProvider(
  supabase: any,
  organizationId: string,
  startTime: Date,
  endTime: Date,
  serviceType?: string
): Promise<{ id: string; name: string; role: string } | null> {
  // Get active providers for this organization
  const { data: providers } = await supabase
    .from('providers')
    .select('id, name, role, role_id')
    .eq('organization_id', organizationId)
    .eq('is_active', true);

  if (!providers || providers.length === 0) {
    return null;
  }

  // If serviceType is provided, we could filter by provider role
  // For now, check each provider for availability
  for (const provider of providers) {
    const isAvailable = await checkProviderAvailability(
      supabase,
      provider.id,
      startTime,
      endTime
    );

    if (isAvailable) {
      return {
        id: provider.id,
        name: provider.name,
        role: provider.role,
      };
    }
  }

  return null;
}

/**
 * Get a valid Google Calendar access token, refreshing if needed
 */
export async function getValidGoogleToken(
  supabase: any,
  organizationId: string
): Promise<string | null> {
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

  // If token is still valid, return it
  if (now < expiresAt) {
    return connection.access_token;
  }

  // Token expired, refresh it
  try {
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
      console.error('Google token refresh failed:', refreshData.error);
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
  } catch (error) {
    console.error('Error refreshing Google token:', error);
    return null;
  }
}

/**
 * Get the selected calendar ID for the organization
 */
export async function getSelectedCalendarId(
  supabase: any,
  organizationId: string
): Promise<string> {
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

interface GoogleCalendarEvent {
  id?: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  external_id?: string;
}

/**
 * Sync a calendar event to Google Calendar
 * Supports create, update, and cancel actions
 */
export async function syncToGoogleCalendar(
  supabase: any,
  organizationId: string,
  event: GoogleCalendarEvent,
  action: 'create' | 'update' | 'cancel'
): Promise<{ success: boolean; googleEventId?: string }> {
  try {
    const accessToken = await getValidGoogleToken(supabase, organizationId);
    if (!accessToken) {
      console.log('No Google Calendar connection, skipping sync');
      return { success: false };
    }

    const calendarId = await getSelectedCalendarId(supabase, organizationId);

    if (action === 'create') {
      const googleEvent = {
        summary: event.title,
        description: event.description || '',
        start: { dateTime: event.start_time },
        end: { dateTime: event.end_time },
      };

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(googleEvent),
        }
      );

      if (response.ok) {
        const googleEventData = await response.json();
        // Update local record with Google event ID
        if (event.id) {
          await supabase
            .from('calendar_events')
            .update({
              external_id: googleEventData.id,
              external_calendar_id: calendarId,
              sync_status: 'synced',
              last_synced_at: new Date().toISOString(),
            })
            .eq('id', event.id);
        }
        return { success: true, googleEventId: googleEventData.id };
      } else {
        console.error('Google Calendar create failed:', await response.text());
        return { success: false };
      }
    }

    if (action === 'update' && event.external_id) {
      const googleEvent = {
        summary: event.title,
        description: event.description || '',
        start: { dateTime: event.start_time },
        end: { dateTime: event.end_time },
      };

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${event.external_id}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(googleEvent),
        }
      );

      if (response.ok) {
        if (event.id) {
          await supabase
            .from('calendar_events')
            .update({
              sync_status: 'synced',
              last_synced_at: new Date().toISOString(),
            })
            .eq('id', event.id);
        }
        return { success: true };
      } else {
        console.error('Google Calendar update failed:', await response.text());
        return { success: false };
      }
    }

    if (action === 'cancel' && event.external_id) {
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${event.external_id}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${accessToken}` },
        }
      );

      // 204 No Content or 404 (already deleted) are both acceptable
      if (response.ok || response.status === 404) {
        return { success: true };
      } else {
        console.error('Google Calendar delete failed:', await response.text());
        return { success: false };
      }
    }

    return { success: false };
  } catch (error) {
    console.error('Google Calendar sync error:', error);
    return { success: false };
  }
}

/**
 * Get organization timezone
 */
export async function getOrganizationTimezone(
  supabase: any,
  organizationId: string
): Promise<string> {
  const { data: org } = await supabase
    .from("organizations")
    .select("timezone")
    .eq("id", organizationId)
    .single();

  return org?.timezone || "America/New_York";
}
