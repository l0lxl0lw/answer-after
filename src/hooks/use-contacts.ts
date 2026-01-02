// Contact hooks (Unified Leads & Customers)
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { InterestLevel, LeadStatus, ContactStatus, ContactSource, Contact } from '@/types/database';

export interface ContactFilters {
  status?: ContactStatus | 'all';
  interest_level?: InterestLevel | 'all';
  lead_status?: LeadStatus | 'all';
  has_name?: boolean | null;
  source?: ContactSource | 'all';
  start_date?: string;
  end_date?: string;
  search?: string;
}

export interface ContactStats {
  total: number;
  hot: number;
  warm: number;
  cold: number;
}

// Hook for fetching contacts with filters
export function useContacts(filters: ContactFilters = {}, page = 1, perPage = 20) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['contacts', user?.institution_id, filters, page, perPage],
    queryFn: async () => {
      if (!user?.institution_id) {
        return { contacts: [], meta: { page: 1, per_page: 20, total: 0, total_pages: 0 }, stats: { total: 0, hot: 0, warm: 0, cold: 0 } };
      }

      let query = supabase
        .from('contacts')
        .select('*', { count: 'exact' })
        .eq('institution_id', user.institution_id);

      // Apply filters
      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      if (filters.interest_level && filters.interest_level !== 'all') {
        query = query.eq('interest_level', filters.interest_level);
      }
      if (filters.lead_status && filters.lead_status !== 'all') {
        query = query.eq('lead_status', filters.lead_status);
      }
      if (filters.has_name === true) {
        query = query.not('name', 'is', null);
      } else if (filters.has_name === false) {
        query = query.is('name', null);
      }
      if (filters.source && filters.source !== 'all') {
        query = query.eq('source', filters.source);
      }
      if (filters.start_date) {
        query = query.gte('created_at', filters.start_date);
      }
      if (filters.end_date) {
        query = query.lte('created_at', filters.end_date);
      }
      if (filters.search) {
        query = query.or(`name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
      }

      const from = (page - 1) * perPage;
      const to = from + perPage - 1;

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      // Fetch stats (total counts by interest level) for the filtered status
      const statsQuery = supabase
        .from('contacts')
        .select('interest_level')
        .eq('institution_id', user.institution_id);

      if (filters.status && filters.status !== 'all') {
        statsQuery.eq('status', filters.status);
      }

      const { data: allContacts } = await statsQuery;

      const stats: ContactStats = {
        total: allContacts?.length || 0,
        hot: allContacts?.filter(c => c.interest_level === 'hot').length || 0,
        warm: allContacts?.filter(c => c.interest_level === 'warm').length || 0,
        cold: allContacts?.filter(c => c.interest_level === 'cold').length || 0,
      };

      return {
        contacts: data || [],
        meta: {
          page,
          per_page: perPage,
          total: count || 0,
          total_pages: Math.ceil((count || 0) / perPage),
        },
        stats,
      };
    },
    enabled: !!user?.institution_id,
  });
}

// Convenience hook for leads (status='lead')
export function useLeads(filters: Omit<ContactFilters, 'status'> = {}, page = 1, perPage = 20) {
  return useContacts({ ...filters, status: 'lead' }, page, perPage);
}

// Convenience hook for customers (status='customer')
export function useCustomers(filters: Omit<ContactFilters, 'status'> = {}, page = 1, perPage = 20) {
  return useContacts({ ...filters, status: 'customer' }, page, perPage);
}

// Hook for fetching a single contact
export function useContact(id: string) {
  return useQuery({
    queryKey: ['contacts', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as Contact;
    },
    enabled: !!id,
  });
}

// Hook for fetching calls for a contact
export function useContactCalls(contactId: string) {
  return useQuery({
    queryKey: ['contacts', contactId, 'calls'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('calls')
        .select('*')
        .eq('contact_id', contactId)
        .order('started_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!contactId,
  });
}

// Hook for looking up contact by phone (for name matching)
export function useContactsByPhone(institutionId: string | undefined) {
  return useQuery({
    queryKey: ['contacts', 'by-phone', institutionId],
    queryFn: async () => {
      if (!institutionId) return new Map<string, Contact>();

      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('institution_id', institutionId);

      if (error) throw error;

      // Build a map of normalized phone -> contact
      const phoneMap = new Map<string, Contact>();
      for (const contact of data || []) {
        const normalizedPhone = contact.phone.replace(/\D/g, '').slice(-10);
        phoneMap.set(normalizedPhone, contact as Contact);
      }
      return phoneMap;
    },
    enabled: !!institutionId,
  });
}

// Hook for creating a contact
export function useCreateContact() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: {
      phone: string;
      name?: string;
      email?: string;
      address?: string;
      notes?: string;
      status?: ContactStatus;
      source?: ContactSource;
    }) => {
      if (!user?.institution_id) throw new Error('No organization');

      const { data: contact, error } = await supabase
        .from('contacts')
        .insert({
          institution_id: user.institution_id,
          phone: data.phone,
          name: data.name || null,
          email: data.email || null,
          address: data.address || null,
          notes: data.notes || null,
          status: data.status || 'customer',
          source: data.source || 'manual',
        })
        .select()
        .single();

      if (error) throw error;
      return contact;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
}

// Hook for updating a contact
export function useUpdateContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      name?: string;
      email?: string;
      address?: string;
      notes?: string;
      status?: ContactStatus;
      interest_level?: InterestLevel;
      lead_status?: LeadStatus;
      lead_notes?: string;
    }) => {
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (data.name !== undefined) updateData.name = data.name;
      if (data.email !== undefined) updateData.email = data.email;
      if (data.address !== undefined) updateData.address = data.address;
      if (data.notes !== undefined) updateData.notes = data.notes;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.interest_level !== undefined) updateData.interest_level = data.interest_level;
      if (data.lead_status !== undefined) updateData.lead_status = data.lead_status;
      if (data.lead_notes !== undefined) {
        updateData.lead_notes = data.lead_notes;
        updateData.lead_updated_at = new Date().toISOString();
      }

      const { data: contact, error } = await supabase
        .from('contacts')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return contact;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['contacts', id] });
    },
  });
}

// Hook for deleting a contact
export function useDeleteContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
}

// Legacy alias for updating leads (now uses contacts table)
export function useUpdateLead() {
  return useUpdateContact();
}
