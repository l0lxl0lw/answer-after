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

export type DashboardPeriod = '7d' | '30d' | '3m' | '6m';

export interface DashboardStats {
  total_calls: number;
  appointments_booked: number;
  revenue_estimate: number;
  calls_trend: number;
  bookings_trend: number;
  revenue_trend: number;
  chart_data: Array<{
    name: string;
    calls: number;
    revenue: number;
  }>;
}

function getPeriodDays(period: DashboardPeriod): number {
  switch (period) {
    case '7d': return 7;
    case '30d': return 30;
    case '3m': return 90;
    case '6m': return 180;
    default: return 7;
  }
}

export function useDashboardStats(period: DashboardPeriod = '7d') {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['dashboard', 'stats', user?.organization_id, period],
    queryFn: async () => {
      if (!user?.organization_id) return null;
      
      const periodDays = getPeriodDays(period);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      
      // Calculate date ranges for current period
      const periodStart = new Date(today);
      periodStart.setDate(periodStart.getDate() - (periodDays - 1));
      periodStart.setHours(0, 0, 0, 0);
      
      // Calculate date ranges for previous period (for trend comparison)
      const prevPeriodEnd = new Date(periodStart);
      prevPeriodEnd.setMilliseconds(-1);
      
      const prevPeriodStart = new Date(prevPeriodEnd);
      prevPeriodStart.setDate(prevPeriodStart.getDate() - (periodDays - 1));
      prevPeriodStart.setHours(0, 0, 0, 0);

      // Get calls for current period
      const { data: periodCalls, error: periodError } = await supabase
        .from('calls')
        .select('id, outcome, started_at, duration_seconds')
        .eq('organization_id', user.organization_id)
        .gte('started_at', periodStart.toISOString())
        .lte('started_at', today.toISOString());
      
      if (periodError) throw periodError;

      // Get calls for previous period
      const { data: prevPeriodCalls, error: prevPeriodError } = await supabase
        .from('calls')
        .select('id, outcome')
        .eq('organization_id', user.organization_id)
        .gte('started_at', prevPeriodStart.toISOString())
        .lte('started_at', prevPeriodEnd.toISOString());
      
      if (prevPeriodError) throw prevPeriodError;

      // Get appointments for current period
      const { data: periodAppointments, error: appointmentsError } = await supabase
        .from('appointments')
        .select('id, created_at')
        .eq('organization_id', user.organization_id)
        .gte('created_at', periodStart.toISOString())
        .lte('created_at', today.toISOString());
      
      if (appointmentsError) throw appointmentsError;

      // Get appointments for previous period
      const { data: prevPeriodAppointments } = await supabase
        .from('appointments')
        .select('id')
        .eq('organization_id', user.organization_id)
        .gte('created_at', prevPeriodStart.toISOString())
        .lte('created_at', prevPeriodEnd.toISOString());

      // Get average service price for revenue estimation
      const { data: services } = await supabase
        .from('services')
        .select('base_price_cents')
        .eq('organization_id', user.organization_id)
        .eq('is_active', true);

      const avgServicePrice = services && services.length > 0
        ? services.reduce((sum, s) => sum + s.base_price_cents, 0) / services.length / 100
        : 150; // Default $150 per booking if no services defined

      // Calculate current period stats
      const totalCalls = periodCalls?.length || 0;
      const totalBookings = periodAppointments?.length || 0;
      const revenueEstimate = totalBookings * avgServicePrice;

      // Calculate previous period stats
      const prevTotalCalls = prevPeriodCalls?.length || 0;
      const prevTotalBookings = prevPeriodAppointments?.length || 0;
      const prevRevenue = prevTotalBookings * avgServicePrice;

      // Calculate trends (percentage change)
      const callsTrend = prevTotalCalls > 0 
        ? Math.round(((totalCalls - prevTotalCalls) / prevTotalCalls) * 100) 
        : totalCalls > 0 ? 100 : 0;
      
      const bookingsTrend = prevTotalBookings > 0 
        ? Math.round(((totalBookings - prevTotalBookings) / prevTotalBookings) * 100) 
        : totalBookings > 0 ? 100 : 0;
      
      const revenueTrend = prevRevenue > 0 
        ? Math.round(((revenueEstimate - prevRevenue) / prevRevenue) * 100) 
        : revenueEstimate > 0 ? 100 : 0;

      // Build chart data - aggregate by day for 7d/30d, by week for 3m/6m
      const chartData: Array<{ name: string; calls: number; revenue: number }> = [];
      
      if (period === '7d') {
        // Daily data for 7 days
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        for (let i = periodDays - 1; i >= 0; i--) {
          const date = new Date(today);
          date.setDate(date.getDate() - i);
          date.setHours(0, 0, 0, 0);
          
          const nextDate = new Date(date);
          nextDate.setDate(nextDate.getDate() + 1);
          
          const dayCalls = periodCalls?.filter(call => {
            const callDate = new Date(call.started_at);
            return callDate >= date && callDate < nextDate;
          }).length || 0;
          
          const dayBookings = periodAppointments?.filter(apt => {
            const aptDate = new Date(apt.created_at);
            return aptDate >= date && aptDate < nextDate;
          }).length || 0;
          
          chartData.push({
            name: dayNames[date.getDay()],
            calls: dayCalls,
            revenue: Math.round(dayBookings * avgServicePrice),
          });
        }
      } else if (period === '30d') {
        // Show every 5 days for 30d
        for (let i = 5; i >= 0; i--) {
          const endDate = new Date(today);
          endDate.setDate(endDate.getDate() - (i * 5));
          endDate.setHours(23, 59, 59, 999);
          
          const startDate = new Date(endDate);
          startDate.setDate(startDate.getDate() - 4);
          startDate.setHours(0, 0, 0, 0);
          
          const rangeCalls = periodCalls?.filter(call => {
            const callDate = new Date(call.started_at);
            return callDate >= startDate && callDate <= endDate;
          }).length || 0;
          
          const rangeBookings = periodAppointments?.filter(apt => {
            const aptDate = new Date(apt.created_at);
            return aptDate >= startDate && aptDate <= endDate;
          }).length || 0;
          
          chartData.push({
            name: `${startDate.getMonth() + 1}/${startDate.getDate()}`,
            calls: rangeCalls,
            revenue: Math.round(rangeBookings * avgServicePrice),
          });
        }
      } else {
        // Weekly aggregation for 3m/6m
        const weeksToShow = period === '3m' ? 12 : 24;
        for (let i = weeksToShow - 1; i >= 0; i--) {
          const endDate = new Date(today);
          endDate.setDate(endDate.getDate() - (i * 7));
          endDate.setHours(23, 59, 59, 999);
          
          const startDate = new Date(endDate);
          startDate.setDate(startDate.getDate() - 6);
          startDate.setHours(0, 0, 0, 0);
          
          const weekCalls = periodCalls?.filter(call => {
            const callDate = new Date(call.started_at);
            return callDate >= startDate && callDate <= endDate;
          }).length || 0;
          
          const weekBookings = periodAppointments?.filter(apt => {
            const aptDate = new Date(apt.created_at);
            return aptDate >= startDate && aptDate <= endDate;
          }).length || 0;
          
          chartData.push({
            name: `${startDate.getMonth() + 1}/${startDate.getDate()}`,
            calls: weekCalls,
            revenue: Math.round(weekBookings * avgServicePrice),
          });
        }
      }

      return {
        total_calls: totalCalls,
        appointments_booked: totalBookings,
        revenue_estimate: Math.round(revenueEstimate),
        calls_trend: callsTrend,
        bookings_trend: bookingsTrend,
        revenue_trend: revenueTrend,
        chart_data: chartData,
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
  credits: number;
  features: string[];
  phone_lines: number;
  has_custom_agent: boolean;
  has_outbound_reminders: boolean;
  has_priority_support: boolean;
  has_api_access: boolean;
  has_call_recordings: boolean;
  has_sla_guarantee: boolean;
  has_hipaa_compliance: boolean;
  has_custom_ai_training: boolean;
  support_level: string;
  is_popular: boolean;
  is_active: boolean;
  is_visible: boolean;
  display_order: number;
  stripe_monthly_price_id: string | null;
}

export function useSubscriptionTiers() {
  return useQuery({
    queryKey: ['subscription-tiers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscription_tiers')
        .select('*')
        .eq('is_active', true)
        .eq('is_visible', true)
        .order('display_order', { ascending: true });
      
      if (error) throw error;
      return data as SubscriptionTier[];
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}
