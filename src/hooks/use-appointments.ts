// Appointment hooks
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { CreateAppointmentRequest, UpdateAppointmentRequest } from '@/types/api';

export function useAppointments(page = 1, perPage = 10) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['appointments', user?.institution_id, page, perPage],
    queryFn: async () => {
      if (!user?.institution_id) return { appointments: [], meta: { page: 1, per_page: 10, total: 0, total_pages: 0 } };

      const from = (page - 1) * perPage;
      const to = from + perPage - 1;

      const { data, error, count } = await supabase
        .from('appointments')
        .select('*', { count: 'exact' })
        .eq('institution_id', user.institution_id)
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
    enabled: !!user?.institution_id,
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
      if (!user?.institution_id) throw new Error('No organization');

      const { data: appointment, error } = await supabase
        .from('appointments')
        .insert({
          institution_id: user.institution_id,
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
