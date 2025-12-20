// React Query hooks for AnswerAfter data fetching
// Uses Supabase for real backend data

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { 
  CallListParams,
  CreateAppointmentRequest,
  UpdateAppointmentRequest,
  CreateTechnicianRequest,
  UpdateTechnicianRequest,
  CreateScheduleRequest,
  UpdateScheduleRequest,
} from '@/types/api';

// ============= Organization Hooks =============

export function useOrganization() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['organization', user?.organization_id],
    queryFn: async () => {
      if (!user?.organization_id) return null;
      
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', user.organization_id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.organization_id,
  });
}

// ============= Dashboard Hooks =============

export function useDashboardStats() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['dashboard', 'stats', user?.organization_id],
    queryFn: async () => {
      if (!user?.organization_id) return null;
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayIso = today.toISOString();
      
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekAgoIso = weekAgo.toISOString();

      // Get calls for today
      const { data: todayCalls, error: todayError } = await supabase
        .from('calls')
        .select('id, is_emergency, outcome, duration_seconds')
        .eq('organization_id', user.organization_id)
        .gte('started_at', todayIso);
      
      if (todayError) throw todayError;

      // Get calls for this week
      const { data: weekCalls, error: weekError } = await supabase
        .from('calls')
        .select('id')
        .eq('organization_id', user.organization_id)
        .gte('started_at', weekAgoIso);
      
      if (weekError) throw weekError;

      // Get appointments booked today
      const { data: todayAppointments } = await supabase
        .from('appointments')
        .select('id')
        .eq('organization_id', user.organization_id)
        .gte('created_at', todayIso);

      const totalCalls = todayCalls?.length || 0;
      const emergencyCalls = todayCalls?.filter(c => c.is_emergency).length || 0;
      const bookedCalls = todayCalls?.filter(c => c.outcome === 'booked').length || 0;
      const avgDuration = totalCalls > 0 
        ? Math.round((todayCalls?.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) || 0) / totalCalls)
        : 0;

      return {
        total_calls_today: totalCalls,
        total_calls_week: weekCalls?.length || 0,
        emergency_calls_today: emergencyCalls,
        appointments_booked_today: todayAppointments?.length || 0,
        technicians_dispatched_today: bookedCalls,
        average_call_duration: avgDuration,
        answer_rate: 98, // This would come from actual call data
        revenue_captured_estimate: bookedCalls * 250, // Rough estimate per booking
      };
    },
    enabled: !!user?.organization_id,
    refetchInterval: 30000,
  });
}

// ============= Call Hooks =============

export function useCalls(params?: CallListParams) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['calls', 'twilio', user?.organization_id, params],
    queryFn: async () => {
      if (!user?.organization_id) return { calls: [], meta: { page: 1, per_page: 20, total: 0, total_pages: 0 } };
      
      // Build query params for edge function
      const queryParams = new URLSearchParams();
      if (params?.search) queryParams.set('search', params.search);
      if (params?.page) queryParams.set('page', params.page.toString());
      if (params?.per_page) queryParams.set('per_page', params.per_page.toString());
      
      const { data, error } = await supabase.functions.invoke('get-twilio-calls', {
        body: null,
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (error) {
        console.error('Error fetching Twilio calls:', error);
        throw error;
      }
      
      // Apply client-side filtering for emergency and outcome since Twilio doesn't have these
      let calls = data?.calls || [];
      
      if (params?.is_emergency !== undefined) {
        calls = calls.filter((c: any) => c.is_emergency === params.is_emergency);
      }
      if (params?.outcome) {
        calls = calls.filter((c: any) => c.outcome === params.outcome);
      }
      if (params?.start_date) {
        calls = calls.filter((c: any) => new Date(c.started_at) >= new Date(params.start_date!));
      }
      if (params?.end_date) {
        calls = calls.filter((c: any) => new Date(c.started_at) <= new Date(params.end_date!));
      }
      
      return {
        calls,
        meta: data?.meta || { page: 1, per_page: 20, total: 0, total_pages: 0 },
      };
    },
    enabled: !!user?.organization_id,
  });
}

export function useCall(id: string) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['calls', 'twilio', id],
    queryFn: async () => {
      // Fetch call details from Twilio via edge function
      const { data, error } = await supabase.functions.invoke('get-twilio-call', {
        body: null,
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      // The edge function uses query params, so we need to call it differently
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-twilio-call?call_sid=${id}`,
        {
          headers: {
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch call details');
      }
      
      const callData = await response.json();
      return callData;
    },
    enabled: !!id && !!user?.organization_id,
  });
}

export function useRecentCalls(limit = 5) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['calls', 'twilio', 'recent', user?.organization_id, limit],
    queryFn: async () => {
      if (!user?.organization_id) return [];
      
      const { data, error } = await supabase.functions.invoke('get-twilio-calls', {
        body: null,
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (error) {
        console.error('Error fetching recent Twilio calls:', error);
        throw error;
      }
      
      // Return only the first 'limit' calls
      return (data?.calls || []).slice(0, limit);
    },
    enabled: !!user?.organization_id,
    refetchInterval: 15000,
  });
}

// ============= Appointment Hooks =============

export function useAppointments(page = 1, perPage = 10) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['appointments', user?.organization_id, page, perPage],
    queryFn: async () => {
      if (!user?.organization_id) return { appointments: [], meta: { page: 1, per_page: 10, total: 0, total_pages: 0 } };
      
      const from = (page - 1) * perPage;
      const to = from + perPage - 1;
      
      const { data, error, count } = await supabase
        .from('appointments')
        .select('*', { count: 'exact' })
        .eq('organization_id', user.organization_id)
        .order('scheduled_start', { ascending: true })
        .range(from, to);
      
      if (error) throw error;
      
      return {
        appointments: data || [],
        meta: {
          page,
          per_page: perPage,
          total: count || 0,
          total_pages: Math.ceil((count || 0) / perPage),
        },
      };
    },
    enabled: !!user?.organization_id,
  });
}

export function useAppointment(id: string) {
  return useQuery({
    queryKey: ['appointments', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateAppointment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (data: CreateAppointmentRequest) => {
      if (!user?.organization_id) throw new Error('No organization');
      
      const { data: appointment, error } = await supabase
        .from('appointments')
        .insert({
          organization_id: user.organization_id,
          call_id: data.call_id || null,
          technician_id: data.technician_id || null,
          customer_name: data.customer_name,
          customer_phone: data.customer_phone,
          customer_address: data.customer_address || null,
          issue_description: data.issue_description,
          scheduled_start: data.scheduled_start,
          scheduled_end: data.scheduled_end,
          is_emergency: data.is_emergency || false,
          notes: data.notes || null,
        })
        .select()
        .single();
      
      if (error) throw error;
      return appointment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });
}

export function useUpdateAppointment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateAppointmentRequest }) => {
      const { data: appointment, error } = await supabase
        .from('appointments')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return appointment;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointments', id] });
    },
  });
}

// ============= Technician Hooks =============

export function useTechnicians() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['technicians', user?.organization_id],
    queryFn: async () => {
      if (!user?.organization_id) return [];
      
      const { data: technicians, error } = await supabase
        .from('technicians')
        .select('*')
        .eq('organization_id', user.organization_id)
        .eq('is_active', true)
        .order('full_name');
      
      if (error) throw error;
      
      // Fetch schedules for each technician
      const techIds = technicians?.map(t => t.id) || [];
      const { data: schedules } = await supabase
        .from('on_call_schedules')
        .select('*')
        .in('technician_id', techIds);
      
      return technicians?.map(tech => ({
        ...tech,
        schedules: schedules?.filter(s => s.technician_id === tech.id) || [],
      })) || [];
    },
    enabled: !!user?.organization_id,
  });
}

export function useTechnician(id: string) {
  return useQuery({
    queryKey: ['technicians', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('technicians')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      
      // Fetch schedules
      const { data: schedules } = await supabase
        .from('on_call_schedules')
        .select('*')
        .eq('technician_id', id);
      
      return { ...data, schedules: schedules || [] };
    },
    enabled: !!id,
  });
}

export function useCreateTechnician() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (data: CreateTechnicianRequest) => {
      if (!user?.organization_id) throw new Error('No organization');
      
      const { data: technician, error } = await supabase
        .from('technicians')
        .insert({
          organization_id: user.organization_id,
          user_id: data.user_id || null,
          full_name: data.full_name,
          phone: data.phone,
          email: data.email || null,
          specializations: data.specializations || [],
        })
        .select()
        .single();
      
      if (error) throw error;
      return technician;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technicians'] });
    },
  });
}

export function useUpdateTechnician() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateTechnicianRequest }) => {
      const { data: technician, error } = await supabase
        .from('technicians')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return technician;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['technicians'] });
      queryClient.invalidateQueries({ queryKey: ['technicians', id] });
    },
  });
}

// ============= Schedule Hooks =============

export function useSchedules() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['schedules', user?.organization_id],
    queryFn: async () => {
      if (!user?.organization_id) return [];
      
      const { data, error } = await supabase
        .from('on_call_schedules')
        .select('*')
        .eq('organization_id', user.organization_id)
        .order('start_datetime', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.organization_id,
  });
}

export function useCurrentOnCall() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['schedules', 'current', user?.organization_id],
    queryFn: async () => {
      if (!user?.organization_id) return { primary: null, backup: null };
      
      const now = new Date().toISOString();
      
      const { data: schedules, error } = await supabase
        .from('on_call_schedules')
        .select(`
          *,
          technician:technicians(*)
        `)
        .eq('organization_id', user.organization_id)
        .lte('start_datetime', now)
        .gte('end_datetime', now);
      
      if (error) throw error;
      
      const primarySchedule = schedules?.find(s => s.is_primary);
      const backupSchedule = schedules?.find(s => !s.is_primary);
      
      return {
        primary: primarySchedule?.technician || null,
        backup: backupSchedule?.technician || null,
      };
    },
    enabled: !!user?.organization_id,
    refetchInterval: 60000,
  });
}

export function useCreateSchedule() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (data: CreateScheduleRequest) => {
      if (!user?.organization_id) throw new Error('No organization');
      
      const { data: schedule, error } = await supabase
        .from('on_call_schedules')
        .insert({
          organization_id: user.organization_id,
          technician_id: data.technician_id,
          start_datetime: data.start_datetime,
          end_datetime: data.end_datetime,
          is_primary: data.is_primary || false,
          notes: data.notes || null,
        })
        .select()
        .single();
      
      if (error) throw error;
      return schedule;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
  });
}

export function useUpdateSchedule() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateScheduleRequest }) => {
      const { data: schedule, error } = await supabase
        .from('on_call_schedules')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return schedule;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      queryClient.invalidateQueries({ queryKey: ['schedules', id] });
    },
  });
}

// ============= Phone Number Hooks =============

export function usePhoneNumbers() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['phoneNumbers', user?.organization_id],
    queryFn: async () => {
      if (!user?.organization_id) return [];
      
      const { data, error } = await supabase
        .from('phone_numbers')
        .select('*')
        .eq('organization_id', user.organization_id)
        .order('created_at');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.organization_id,
  });
}

// ============= Subscription Hooks =============

export function useSubscription() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['subscription', user?.organization_id],
    queryFn: async () => {
      if (!user?.organization_id) return null;
      
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('organization_id', user.organization_id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.organization_id,
  });
}

// ============= Users Hooks =============

export function useUsers(page = 1, perPage = 10) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['users', user?.organization_id, page, perPage],
    queryFn: async () => {
      if (!user?.organization_id) return { users: [], meta: { page: 1, per_page: 10, total: 0, total_pages: 0 } };
      
      const from = (page - 1) * perPage;
      const to = from + perPage - 1;
      
      const { data, error, count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact' })
        .eq('organization_id', user.organization_id)
        .range(from, to);
      
      if (error) throw error;
      
      return {
        users: data || [],
        meta: {
          page,
          per_page: perPage,
          total: count || 0,
          total_pages: Math.ceil((count || 0) / perPage),
        },
      };
    },
    enabled: !!user?.organization_id,
  });
}

// ============= Subscription Tiers Hooks =============

export interface SubscriptionTier {
  id: string;
  plan_id: string;
  name: string;
  price_cents: number;
  period: string;
  description: string;
  credits: number;
  credits_cost_per_thousand: number | null;
  phone_lines: number;
  has_custom_ai_training: boolean;
  has_call_recordings: boolean;
  has_api_access: boolean;
  has_priority_support: boolean;
  has_hipaa_compliance: boolean;
  has_sla_guarantee: boolean;
  support_level: string;
  is_popular: boolean;
  display_order: number;
  features: string[];
}

export function useSubscriptionTiers() {
  return useQuery({
    queryKey: ['subscription-tiers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscription_tiers')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      
      if (error) throw error;
      
      return (data || []).map(tier => ({
        ...tier,
        features: Array.isArray(tier.features) ? tier.features : [],
      })) as SubscriptionTier[];
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
}
