import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { ProviderRole } from "./use-roles";

// ============================================
// TYPES
// ============================================

export interface Provider {
  id: string;
  organization_id: string;
  user_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;                    // Legacy field, kept for backward compat
  role_id: string | null;          // FK to provider_roles table
  role_data?: ProviderRole | null; // Joined role data
  color: string;
  is_active: boolean;
  external_id: string | null;
  google_calendar_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProviderSchedule {
  id: string;
  provider_id: string;
  day_of_week: number; // 0=Sunday, 6=Saturday
  start_time: string;  // HH:MM format
  end_time: string;
  is_available: boolean;
  created_at: string;
}

export interface ProviderScheduleOverride {
  id: string;
  provider_id: string;
  override_date: string;  // YYYY-MM-DD format
  start_time: string | null;
  end_time: string | null;
  is_available: boolean;
  reason: string | null;
  created_at: string;
}

export interface CreateProviderRequest {
  name: string;
  email?: string;
  phone?: string;
  role_id: string;  // FK to provider_roles
  color?: string;
  is_active?: boolean;
}

export interface UpdateProviderRequest {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  role_id?: string;  // FK to provider_roles
  color?: string;
  is_active?: boolean;
  google_calendar_id?: string;
}

export interface ScheduleEntry {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
}

export interface CreateOverrideRequest {
  provider_id: string;
  override_date: string;
  start_time?: string;
  end_time?: string;
  is_available: boolean;
  reason?: string;
}

// ============================================
// PROVIDER HOOKS
// ============================================

/**
 * Fetch all providers for the current organization
 */
export function useProviders() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["providers", user?.organization_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("providers")
        .select(`
          *,
          role_data:provider_roles(*)
        `)
        .order("name");

      if (error) throw error;
      return data as Provider[];
    },
    enabled: !!user?.organization_id,
  });
}

/**
 * Fetch active providers only
 */
export function useActiveProviders() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["providers", "active", user?.organization_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("providers")
        .select(`
          *,
          role_data:provider_roles(*)
        `)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data as Provider[];
    },
    enabled: !!user?.organization_id,
  });
}

/**
 * Fetch a single provider by ID
 */
export function useProvider(providerId: string | undefined) {
  return useQuery({
    queryKey: ["provider", providerId],
    queryFn: async () => {
      if (!providerId) return null;

      const { data, error } = await supabase
        .from("providers")
        .select(`
          *,
          role_data:provider_roles(*)
        `)
        .eq("id", providerId)
        .single();

      if (error) throw error;
      return data as Provider;
    },
    enabled: !!providerId,
  });
}

/**
 * Create a new provider
 */
export function useCreateProvider() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: CreateProviderRequest) => {
      if (!user?.organization_id) throw new Error("No organization");

      const { data: provider, error } = await supabase
        .from("providers")
        .insert({
          organization_id: user.organization_id,
          ...data,
        })
        .select()
        .single();

      if (error) throw error;
      return provider as Provider;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["providers"] });
      toast.success("Provider added");
    },
    onError: (error) => {
      toast.error("Failed to add provider", { description: error.message });
    },
  });
}

/**
 * Update an existing provider
 */
export function useUpdateProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateProviderRequest) => {
      const { data: provider, error } = await supabase
        .from("providers")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return provider as Provider;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["providers"] });
      queryClient.invalidateQueries({ queryKey: ["provider", data.id] });
      toast.success("Provider updated");
    },
    onError: (error) => {
      toast.error("Failed to update provider", { description: error.message });
    },
  });
}

/**
 * Delete a provider
 */
export function useDeleteProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (providerId: string) => {
      const { error } = await supabase
        .from("providers")
        .delete()
        .eq("id", providerId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["providers"] });
      toast.success("Provider removed");
    },
    onError: (error) => {
      toast.error("Failed to remove provider", { description: error.message });
    },
  });
}

// ============================================
// PROVIDER SCHEDULE HOOKS
// ============================================

/**
 * Fetch schedule for a provider
 */
export function useProviderSchedule(providerId: string | undefined) {
  return useQuery({
    queryKey: ["provider-schedule", providerId],
    queryFn: async () => {
      if (!providerId) return [];

      const { data, error } = await supabase
        .from("provider_schedules")
        .select("*")
        .eq("provider_id", providerId)
        .order("day_of_week")
        .order("start_time");

      if (error) throw error;
      return data as ProviderSchedule[];
    },
    enabled: !!providerId,
  });
}

/**
 * Update provider schedule (replaces all entries for a provider)
 */
export function useUpdateProviderSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      providerId,
      schedules,
    }: {
      providerId: string;
      schedules: ScheduleEntry[];
    }) => {
      // Delete existing schedules
      const { error: deleteError } = await supabase
        .from("provider_schedules")
        .delete()
        .eq("provider_id", providerId);

      if (deleteError) throw deleteError;

      // Insert new schedules if any
      if (schedules.length > 0) {
        const { error: insertError } = await supabase
          .from("provider_schedules")
          .insert(
            schedules.map((s) => ({
              provider_id: providerId,
              ...s,
            }))
          );

        if (insertError) throw insertError;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["provider-schedule", variables.providerId],
      });
      toast.success("Schedule updated");
    },
    onError: (error) => {
      toast.error("Failed to update schedule", { description: error.message });
    },
  });
}

// ============================================
// PROVIDER SCHEDULE OVERRIDE HOOKS
// ============================================

/**
 * Fetch overrides for a provider within a date range
 */
export function useProviderOverrides(
  providerId: string | undefined,
  startDate?: string,
  endDate?: string
) {
  return useQuery({
    queryKey: ["provider-overrides", providerId, startDate, endDate],
    queryFn: async () => {
      if (!providerId) return [];

      let query = supabase
        .from("provider_schedule_overrides")
        .select("*")
        .eq("provider_id", providerId)
        .order("override_date");

      if (startDate) {
        query = query.gte("override_date", startDate);
      }
      if (endDate) {
        query = query.lte("override_date", endDate);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as ProviderScheduleOverride[];
    },
    enabled: !!providerId,
  });
}

/**
 * Create a schedule override
 */
export function useCreateOverride() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateOverrideRequest) => {
      const { data: override, error } = await supabase
        .from("provider_schedule_overrides")
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return override as ProviderScheduleOverride;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["provider-overrides", data.provider_id],
      });
      toast.success("Schedule exception added");
    },
    onError: (error) => {
      toast.error("Failed to add exception", { description: error.message });
    },
  });
}

/**
 * Delete a schedule override
 */
export function useDeleteOverride() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      overrideId,
      providerId,
    }: {
      overrideId: string;
      providerId: string;
    }) => {
      const { error } = await supabase
        .from("provider_schedule_overrides")
        .delete()
        .eq("id", overrideId);

      if (error) throw error;
      return providerId;
    },
    onSuccess: (providerId) => {
      queryClient.invalidateQueries({
        queryKey: ["provider-overrides", providerId],
      });
      toast.success("Schedule exception removed");
    },
    onError: (error) => {
      toast.error("Failed to remove exception", { description: error.message });
    },
  });
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get display color for a provider role
 */
export function getProviderRoleColor(role: string): string {
  const colors: Record<string, string> = {
    dentist: "#3b82f6",     // Blue
    hygienist: "#10b981",   // Green
    assistant: "#f59e0b",   // Amber
    receptionist: "#8b5cf6", // Purple
    specialist: "#ef4444",  // Red
  };
  return colors[role.toLowerCase()] || "#6b7280"; // Gray default
}

/**
 * Format day of week for display
 */
export function formatDayOfWeek(day: number): string {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return days[day] || "";
}

/**
 * Format day of week as short form
 */
export function formatDayOfWeekShort(day: number): string {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return days[day] || "";
}

/**
 * Provider role options for forms
 * @deprecated Use useRoles() hook instead - roles are now stored in the database
 */
export const PROVIDER_ROLES = [
  { value: "dentist", label: "Dentist" },
  { value: "hygienist", label: "Dental Hygienist" },
  { value: "assistant", label: "Dental Assistant" },
  { value: "specialist", label: "Specialist" },
  { value: "receptionist", label: "Receptionist" },
] as const;

/**
 * Default provider colors for calendar display
 */
export const PROVIDER_COLORS = [
  "#3b82f6", // Blue
  "#10b981", // Green
  "#f59e0b", // Amber
  "#ef4444", // Red
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#06b6d4", // Cyan
  "#f97316", // Orange
] as const;
