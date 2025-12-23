// React Query hooks for AnswerAfter data fetching
// Uses Supabase for real backend data

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { 
  CallListParams,
  CreateAppointmentRequest,
  UpdateAppointmentRequest,
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

export interface DashboardStats {
  total_calls_week: number;
  appointments_booked_week: number;
  revenue_estimate: number;
  calls_trend: number;
  bookings_trend: number;
  revenue_trend: number;
  daily_data: Array<{
    name: string;
    calls: number;
    revenue: number;
  }>;
}

export function useDashboardStats() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['dashboard', 'stats', user?.organization_id],
    queryFn: async () => {
      if (!user?.organization_id) return null;
      
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      
      // Calculate date ranges
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - 6);
      weekStart.setHours(0, 0, 0, 0);
      
      const prevWeekStart = new Date(weekStart);
      prevWeekStart.setDate(prevWeekStart.getDate() - 7);
      
      const prevWeekEnd = new Date(weekStart);
      prevWeekEnd.setMilliseconds(-1);

      // Get calls for this week
      const { data: weekCalls, error: weekError } = await supabase
        .from('calls')
        .select('id, outcome, started_at, duration_seconds')
        .eq('organization_id', user.organization_id)
        .gte('started_at', weekStart.toISOString())
        .lte('started_at', today.toISOString());
      
      if (weekError) throw weekError;

      // Get calls for previous week (for trend calculation)
      const { data: prevWeekCalls, error: prevWeekError } = await supabase
        .from('calls')
        .select('id, outcome')
        .eq('organization_id', user.organization_id)
        .gte('started_at', prevWeekStart.toISOString())
        .lte('started_at', prevWeekEnd.toISOString());
      
      if (prevWeekError) throw prevWeekError;

      // Get appointments for this week
      const { data: weekAppointments, error: appointmentsError } = await supabase
        .from('appointments')
        .select('id, created_at')
        .eq('organization_id', user.organization_id)
        .gte('created_at', weekStart.toISOString())
        .lte('created_at', today.toISOString());
      
      if (appointmentsError) throw appointmentsError;

      // Get appointments for previous week
      const { data: prevWeekAppointments } = await supabase
        .from('appointments')
        .select('id')
        .eq('organization_id', user.organization_id)
        .gte('created_at', prevWeekStart.toISOString())
        .lte('created_at', prevWeekEnd.toISOString());

      // Get average service price for revenue estimation
      const { data: services } = await supabase
        .from('services')
        .select('base_price_cents')
        .eq('organization_id', user.organization_id)
        .eq('is_active', true);

      const avgServicePrice = services && services.length > 0
        ? services.reduce((sum, s) => sum + s.base_price_cents, 0) / services.length / 100
        : 150; // Default $150 per booking if no services defined

      // Calculate current week stats
      const totalCallsWeek = weekCalls?.length || 0;
      const totalBookingsWeek = weekAppointments?.length || 0;
      const revenueEstimate = totalBookingsWeek * avgServicePrice;

      // Calculate previous week stats
      const prevTotalCalls = prevWeekCalls?.length || 0;
      const prevTotalBookings = prevWeekAppointments?.length || 0;
      const prevRevenue = prevTotalBookings * avgServicePrice;

      // Calculate trends (percentage change)
      const callsTrend = prevTotalCalls > 0 
        ? Math.round(((totalCallsWeek - prevTotalCalls) / prevTotalCalls) * 100) 
        : totalCallsWeek > 0 ? 100 : 0;
      
      const bookingsTrend = prevTotalBookings > 0 
        ? Math.round(((totalBookingsWeek - prevTotalBookings) / prevTotalBookings) * 100) 
        : totalBookingsWeek > 0 ? 100 : 0;
      
      const revenueTrend = prevRevenue > 0 
        ? Math.round(((revenueEstimate - prevRevenue) / prevRevenue) * 100) 
        : revenueEstimate > 0 ? 100 : 0;

      // Build daily data for chart (last 7 days)
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dailyData: Array<{ name: string; calls: number; revenue: number }> = [];
      
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);
        
        const dayName = dayNames[date.getDay()];
        
        // Count calls for this day
        const dayCalls = weekCalls?.filter(call => {
          const callDate = new Date(call.started_at);
          return callDate >= date && callDate < nextDate;
        }).length || 0;
        
        // Count bookings for this day and estimate revenue
        const dayBookings = weekAppointments?.filter(apt => {
          const aptDate = new Date(apt.created_at);
          return aptDate >= date && aptDate < nextDate;
        }).length || 0;
        
        dailyData.push({
          name: dayName,
          calls: dayCalls,
          revenue: Math.round(dayBookings * avgServicePrice),
        });
      }

      return {
        total_calls_week: totalCallsWeek,
        appointments_booked_week: totalBookingsWeek,
        revenue_estimate: Math.round(revenueEstimate),
        calls_trend: callsTrend,
        bookings_trend: bookingsTrend,
        revenue_trend: revenueTrend,
        daily_data: dailyData,
      } as DashboardStats;
    },
    enabled: !!user?.organization_id,
    refetchInterval: 30000,
  });
}

// ============= Call Hooks =============

export interface Conversation {
  id: string;
  conversation_id: string;
  status: string;
  started_at: string;
  duration_seconds: number;
  message_count: number;
  summary: string | null;
  call_successful: string | null;
}

export function useConversations(params?: { search?: string; page?: number; per_page?: number }) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['conversations', user?.organization_id, params],
    queryFn: async () => {
      if (!user?.organization_id) return { conversations: [], meta: { page: 1, per_page: 20, total: 0, has_more: false } };
      
      const session = await supabase.auth.getSession();
      
      // Build query params
      const queryParams = new URLSearchParams();
      if (params?.search) queryParams.set('search', params.search);
      if (params?.page) queryParams.set('page', params.page.toString());
      if (params?.per_page) queryParams.set('per_page', params.per_page.toString());
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-elevenlabs-conversations?${queryParams.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${session.data.session?.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch conversations');
      }
      
      const data = await response.json();
      
      return {
        conversations: data.conversations as Conversation[],
        meta: data.meta,
      };
    },
    enabled: !!user?.organization_id,
  });
}

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
      
      // Apply client-side filtering for outcome since Twilio doesn't have these
      let calls = data?.calls || [];
      
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
    queryKey: ['calls', 'conversation', id],
    queryFn: async () => {
      // Fetch conversation details from ElevenLabs via edge function
      const session = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-elevenlabs-conversation?conversation_id=${id}`,
        {
          headers: {
            'Authorization': `Bearer ${session.data.session?.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch conversation details');
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
          customer_name: data.customer_name,
          customer_phone: data.customer_phone,
          customer_address: data.customer_address || null,
          issue_description: data.issue_description,
          scheduled_start: data.scheduled_start,
          scheduled_end: data.scheduled_end,
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

// ============= Phone Number Hooks =============

export function usePhoneNumbers() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['phone-numbers', user?.organization_id],
    queryFn: async () => {
      if (!user?.organization_id) return [];
      
      const { data, error } = await supabase
        .from('phone_numbers')
        .select('*')
        .eq('organization_id', user.organization_id)
        .order('created_at', { ascending: false });
      
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

// ============= User Hooks =============

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
        .order('full_name')
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

// ============= Subscription Tier Hooks =============

export interface SubscriptionTier {
  id: string;
  plan_id: string;
  name: string;
  description: string;
  price_cents: number;
  period: string;
  credits: number;
  credits_cost_per_thousand: number | null;
  phone_lines: number;
  features: string[];
  has_call_recordings: boolean;
  has_custom_agent: boolean;
  has_outbound_reminders: boolean;
  has_priority_support: boolean;
  has_api_access: boolean;
  has_custom_ai_training: boolean;
  has_hipaa_compliance: boolean;
  has_sla_guarantee: boolean;
  support_level: string;
  is_popular: boolean;
  is_active: boolean;
  display_order: number;
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
      return data as SubscriptionTier[];
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}
