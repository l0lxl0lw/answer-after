import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format, startOfDay, endOfDay, addDays } from "date-fns";
import { isDemoMode } from "@/lib/demo/config";

// ============================================
// TYPES
// ============================================

export interface CalendarEvent {
  id: string;
  account_id: string;
  provider_id: string | null;
  appointment_id: string | null;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  status: "confirmed" | "tentative" | "cancelled";
  color: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  source: "native" | "google" | "nexhealth" | "other_pms";
  external_id: string | null;
  external_calendar_id: string | null;
  sync_status: "synced" | "pending_push" | "pending_pull" | "conflict";
  last_synced_at: string | null;
  external_updated_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  provider?: {
    id: string;
    name: string;
    color: string;
    role: string;
  };
}

export interface CreateEventRequest {
  provider_id?: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  status?: "confirmed" | "tentative" | "cancelled";
  color?: string;
  customer_name?: string;
  customer_phone?: string;
}

export interface UpdateEventRequest {
  id: string;
  provider_id?: string;
  title?: string;
  description?: string;
  start_time?: string;
  end_time?: string;
  status?: "confirmed" | "tentative" | "cancelled";
  color?: string;
  customer_name?: string;
  customer_phone?: string;
}

export interface CalendarFilters {
  providerIds?: string[];
  startDate: Date;
  endDate: Date;
  status?: string[];
}

export interface TimeSlot {
  time: string; // HH:MM format
  date: Date;
  available: boolean;
  event?: CalendarEvent;
}

// ============================================
// CALENDAR EVENT HOOKS
// ============================================

/**
 * Fetch calendar events for a date range
 */
export function useCalendarEvents(filters: CalendarFilters) {
  const { user } = useAuth();

  return useQuery({
    queryKey: [
      "calendar-events",
      user?.account_id,
      filters.startDate.toISOString(),
      filters.endDate.toISOString(),
      filters.providerIds,
      filters.status,
    ],
    queryFn: async () => {
      if (isDemoMode()) {
        // Return mock calendar events
        return [
          {
            id: 'event-1',
            title: 'HVAC Diagnostic - Sarah Johnson',
            start_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            end_time: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(),
            status: 'confirmed',
            customer_name: 'Sarah Johnson',
            customer_phone: '+15553334444',
          },
          {
            id: 'event-2',
            title: 'AC Tune-Up - John Smith',
            start_time: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
            end_time: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 90 * 60 * 1000).toISOString(),
            status: 'confirmed',
            customer_name: 'John Smith',
            customer_phone: '+15552223333',
          },
        ] as CalendarEvent[];
      }

      let query = supabase
        .from("calendar_events")
        .select(
          `
          *,
          provider:providers(id, name, color, role)
        `
        )
        .gte("start_time", filters.startDate.toISOString())
        .lte("start_time", filters.endDate.toISOString())
        .order("start_time");

      if (filters.providerIds && filters.providerIds.length > 0) {
        query = query.in("provider_id", filters.providerIds);
      }

      if (filters.status && filters.status.length > 0) {
        query = query.in("status", filters.status);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as CalendarEvent[];
    },
    enabled: !!user?.account_id || isDemoMode(),
  });
}

/**
 * Fetch events for a single day (convenience hook)
 */
export function useDayEvents(date: Date, providerIds?: string[]) {
  return useCalendarEvents({
    startDate: startOfDay(date),
    endDate: endOfDay(date),
    providerIds,
  });
}

/**
 * Fetch events for a week
 */
export function useWeekEvents(startDate: Date, providerIds?: string[]) {
  return useCalendarEvents({
    startDate: startOfDay(startDate),
    endDate: endOfDay(addDays(startDate, 6)),
    providerIds,
  });
}

/**
 * Create a new calendar event
 */
export function useCreateCalendarEvent() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: CreateEventRequest) => {
      if (!user?.account_id) throw new Error("No organization");

      const { data: event, error } = await supabase
        .from("calendar_events")
        .insert({
          account_id: user.account_id,
          source: "native",
          sync_status: "synced",
          ...data,
        })
        .select(
          `
          *,
          provider:providers(id, name, color, role)
        `
        )
        .single();

      if (error) throw error;
      return event as CalendarEvent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      toast.success("Event created");
    },
    onError: (error) => {
      toast.error("Failed to create event", { description: error.message });
    },
  });
}

/**
 * Update a calendar event
 */
export function useUpdateCalendarEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateEventRequest) => {
      const { data: event, error } = await supabase
        .from("calendar_events")
        .update({
          ...data,
          // Mark as pending push if it's a native event being modified
          sync_status: "pending_push",
        })
        .eq("id", id)
        .select(
          `
          *,
          provider:providers(id, name, color, role)
        `
        )
        .single();

      if (error) throw error;
      return event as CalendarEvent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      toast.success("Event updated");
    },
    onError: (error) => {
      toast.error("Failed to update event", { description: error.message });
    },
  });
}

/**
 * Delete a calendar event
 */
export function useDeleteCalendarEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase
        .from("calendar_events")
        .delete()
        .eq("id", eventId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      toast.success("Event deleted");
    },
    onError: (error) => {
      toast.error("Failed to delete event", { description: error.message });
    },
  });
}

// ============================================
// AVAILABILITY HOOKS
// ============================================

/**
 * Calculate available time slots for a provider on a given date
 */
export function useAvailableSlots(
  providerId: string | undefined,
  date: Date,
  durationMinutes: number = 30
) {
  const { user } = useAuth();

  return useQuery({
    queryKey: [
      "available-slots",
      providerId,
      format(date, "yyyy-MM-dd"),
      durationMinutes,
    ],
    queryFn: async () => {
      if (!providerId) return [];

      // Get provider's schedule for this day of week
      const dayOfWeek = date.getDay();
      const { data: schedules, error: scheduleError } = await supabase
        .from("provider_schedules")
        .select("*")
        .eq("provider_id", providerId)
        .eq("day_of_week", dayOfWeek)
        .eq("is_available", true);

      if (scheduleError) throw scheduleError;

      // Get overrides for this date
      const dateStr = format(date, "yyyy-MM-dd");
      const { data: overrides, error: overrideError } = await supabase
        .from("provider_schedule_overrides")
        .select("*")
        .eq("provider_id", providerId)
        .eq("override_date", dateStr);

      if (overrideError) throw overrideError;

      // Check if entire day is blocked
      const dayBlocked = overrides?.some(
        (o) => !o.is_available && o.start_time === null
      );
      if (dayBlocked) return [];

      // Get existing events for this day
      const { data: events, error: eventsError } = await supabase
        .from("calendar_events")
        .select("start_time, end_time")
        .eq("provider_id", providerId)
        .gte("start_time", startOfDay(date).toISOString())
        .lte("start_time", endOfDay(date).toISOString())
        .neq("status", "cancelled");

      if (eventsError) throw eventsError;

      // Generate available slots based on schedule
      const slots: TimeSlot[] = [];

      if (!schedules || schedules.length === 0) return slots;

      for (const schedule of schedules) {
        const startTime = parseTime(schedule.start_time);
        const endTime = parseTime(schedule.end_time);

        // Generate 5-minute slots
        for (let mins = startTime; mins + durationMinutes <= endTime; mins += 5) {
          const slotStart = new Date(date);
          slotStart.setHours(Math.floor(mins / 60), mins % 60, 0, 0);

          const slotEnd = new Date(slotStart);
          slotEnd.setMinutes(slotEnd.getMinutes() + durationMinutes);

          // Check if slot conflicts with existing events
          const hasConflict = events?.some((event) => {
            const eventStart = new Date(event.start_time);
            const eventEnd = new Date(event.end_time);
            return slotStart < eventEnd && slotEnd > eventStart;
          });

          // Check if slot is blocked by override
          const isBlocked = overrides?.some((override) => {
            if (!override.start_time) return false;
            const overrideStart = parseTime(override.start_time);
            const overrideEnd = parseTime(override.end_time);
            return !override.is_available && mins >= overrideStart && mins < overrideEnd;
          });

          if (!hasConflict && !isBlocked) {
            slots.push({
              time: formatMinutesToTime(mins),
              date: slotStart,
              available: true,
            });
          }
        }
      }

      return slots;
    },
    enabled: !!providerId && !!user?.account_id,
  });
}

// ============================================
// SYNC HOOKS
// ============================================

/**
 * Get sync status and conflicts
 */
export function useSyncStatus() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["sync-status", user?.account_id],
    queryFn: async () => {
      const { data: conflicts, error } = await supabase
        .from("calendar_events")
        .select("id, title, start_time, sync_status, source")
        .eq("sync_status", "conflict");

      if (error) throw error;

      const { count: pendingCount } = await supabase
        .from("calendar_events")
        .select("id", { count: "exact", head: true })
        .in("sync_status", ["pending_push", "pending_pull"]);

      return {
        conflicts: conflicts || [],
        pendingCount: pendingCount || 0,
        hasConflicts: (conflicts?.length || 0) > 0,
      };
    },
    enabled: !!user?.account_id,
    refetchInterval: 30000, // Check every 30 seconds
  });
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Parse time string (HH:MM or HH:MM:SS) to minutes since midnight
 */
function parseTime(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Format minutes since midnight to HH:MM
 */
function formatMinutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

/**
 * Format time for display (12-hour format)
 */
export function formatTimeDisplay(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const h = hours % 12 || 12;
  const ampm = hours >= 12 ? "PM" : "AM";
  return `${h}:${minutes.toString().padStart(2, "0")} ${ampm}`;
}

/**
 * Generate time options for selects (5-minute intervals)
 */
export function generateTimeOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 5) {
      const value = `${hour.toString().padStart(2, "0")}:${minute
        .toString()
        .padStart(2, "0")}`;
      options.push({
        value,
        label: formatTimeDisplay(value),
      });
    }
  }
  return options;
}

/**
 * Get event color (use provider color or custom color)
 */
export function getEventColor(event: CalendarEvent): string {
  return event.color || event.provider?.color || "#3b82f6";
}

/**
 * Check if two time ranges overlap
 */
export function doTimesOverlap(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date
): boolean {
  return start1 < end2 && end1 > start2;
}
