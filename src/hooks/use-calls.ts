// Call hooks
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { isDemoMode } from '@/lib/demo/config';
import { mockCalls, mockContacts } from '@/lib/demo/mockData';
import type { CallListParams } from '@/types/api';

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

// Call from database (preferred - no external API calls)
export interface CallRecord {
  id: string;
  account_id: string;
  caller_phone: string;
  caller_name: string | null;
  status: string;
  outcome: string | null;
  duration_seconds: number | null;
  summary: string | null;
  started_at: string;
  ended_at: string | null;
  elevenlabs_conversation_id: string | null;
  contact?: {
    id: string;
    name: string | null;
  } | null;
}

/**
 * Fetch call history directly from the database
 * This is the preferred hook - no external API calls, faster loading
 */
export function useCallHistory(params?: { search?: string; page?: number; per_page?: number }) {
  const { user } = useAuth();
  const page = params?.page || 1;
  const perPage = params?.per_page || 20;

  return useQuery({
    queryKey: ['call-history', user?.account_id, params],
    queryFn: async () => {
      // Demo mode: return mock data
      if (isDemoMode()) {
        await new Promise(resolve => setTimeout(resolve, 200));
        let filteredCalls = [...mockCalls];

        if (params?.search) {
          const search = params.search.toLowerCase();
          filteredCalls = filteredCalls.filter(c =>
            c.caller_phone.includes(search) ||
            c.caller_name?.toLowerCase().includes(search) ||
            c.summary?.toLowerCase().includes(search)
          );
        }

        filteredCalls.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
        const from = (page - 1) * perPage;
        const to = from + perPage;

        return {
          calls: filteredCalls.slice(from, to).map(c => ({
            ...c,
            contact: c.contact_id ? mockContacts.find(ct => ct.id === c.contact_id) : null,
          })),
          total: filteredCalls.length,
          page,
          per_page: perPage,
        };
      }

      if (!user?.account_id) return { calls: [], total: 0, page, per_page: perPage };

      // Build query
      let query = supabase
        .from('calls')
        .select(`
          id,
          account_id,
          caller_phone,
          caller_name,
          status,
          outcome,
          duration_seconds,
          summary,
          started_at,
          ended_at,
          elevenlabs_conversation_id,
          contact:contact_id(id, name)
        `, { count: 'exact' })
        .eq('account_id', user.account_id)
        .order('started_at', { ascending: false });

      // Apply search filter
      if (params?.search) {
        query = query.or(`caller_phone.ilike.%${params.search}%,caller_name.ilike.%${params.search}%,summary.ilike.%${params.search}%`);
      }

      // Apply pagination
      const from = (page - 1) * perPage;
      const to = from + perPage - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) {
        console.error('Error fetching call history:', error);
        throw error;
      }

      return {
        calls: (data || []) as CallRecord[],
        total: count || 0,
        page,
        per_page: perPage,
      };
    },
    enabled: !!user?.account_id || isDemoMode(),
  });
}

/**
 * Fetch a single call from database, with option to get ElevenLabs details
 */
export function useCallDetail(callId: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['call-detail', callId],
    queryFn: async () => {
      if (!callId) return null;

      // Get call from database
      const { data: call, error } = await supabase
        .from('calls')
        .select(`
          id,
          account_id,
          caller_phone,
          caller_name,
          status,
          outcome,
          duration_seconds,
          summary,
          started_at,
          ended_at,
          elevenlabs_conversation_id,
          contact:contact_id(id, name)
        `)
        .eq('id', callId)
        .single();

      if (error) {
        console.error('Error fetching call:', error);
        throw error;
      }

      return call as CallRecord;
    },
    enabled: !!callId && !!user?.account_id,
  });
}

export function useConversations(params?: { search?: string; page?: number; per_page?: number }) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['conversations', user?.account_id, params],
    queryFn: async () => {
      if (!user?.account_id) return { conversations: [], meta: { page: 1, per_page: 20, total: 0, has_more: false } };

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
    enabled: !!user?.account_id,
  });
}

export function useCalls(params?: CallListParams) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['calls', 'twilio', user?.account_id, params],
    queryFn: async () => {
      if (!user?.account_id) return { calls: [], meta: { page: 1, per_page: 20, total: 0, total_pages: 0 } };

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
    enabled: !!user?.account_id,
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
    enabled: !!id && !!user?.account_id,
  });
}

export function useRecentCalls(limit = 5) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['calls', 'twilio', 'recent', user?.account_id, limit],
    queryFn: async () => {
      // Demo mode: return mock data
      if (isDemoMode()) {
        await new Promise(resolve => setTimeout(resolve, 150));
        const sorted = [...mockCalls].sort(
          (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
        );
        return sorted.slice(0, limit);
      }

      if (!user?.account_id) return [];

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
    enabled: !!user?.account_id || isDemoMode(),
    refetchInterval: isDemoMode() ? false : 15000,
  });
}
