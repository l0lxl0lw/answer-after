// Service hooks
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { isDemoMode } from '@/lib/demo/config';
import { mockServices } from '@/lib/demo/mockData';

// ============================================
// TYPES
// ============================================

export interface Service {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  duration_minutes: number;
  category: string;
  is_active: boolean;
  account_id: string;
  created_at: string;
}

export interface CreateServiceRequest {
  name: string;
  description?: string;
  price_cents: number;
  duration_minutes: number;
  category: string;
  is_active?: boolean;
}

export interface UpdateServiceRequest {
  id: string;
  name?: string;
  description?: string;
  price_cents?: number;
  duration_minutes?: number;
  category?: string;
  is_active?: boolean;
}

// Service categories
export const SERVICE_CATEGORIES = [
  { value: 'routine', label: 'Routine', description: 'Regular scheduled services' },
  { value: 'emergency', label: 'Emergency', description: 'Urgent same-day services' },
  { value: 'maintenance', label: 'Maintenance', description: 'Preventive maintenance' },
  { value: 'consultation', label: 'Consultation', description: 'Consultations and evaluations' },
  { value: 'specialty', label: 'Specialty', description: 'Specialized procedures' },
] as const;

export type ServiceCategory = typeof SERVICE_CATEGORIES[number]['value'];

// ============================================
// HOOKS
// ============================================

/**
 * Fetch all services for the current account
 */
export function useServices() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['services', user?.account_id],
    queryFn: async () => {
      if (isDemoMode()) {
        return mockServices as Service[];
      }

      if (!user?.account_id) return [];

      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('account_id', user.account_id)
        .order('category')
        .order('name');

      if (error) throw error;
      return data as Service[];
    },
    enabled: !!user?.account_id || isDemoMode(),
  });
}

/**
 * Fetch active services only
 */
export function useActiveServices() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['services', 'active', user?.account_id],
    queryFn: async () => {
      if (isDemoMode()) {
        return mockServices.filter(s => s.is_active) as Service[];
      }

      if (!user?.account_id) return [];

      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('account_id', user.account_id)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data as Service[];
    },
    enabled: !!user?.account_id || isDemoMode(),
  });
}

/**
 * Create a new service
 */
export function useCreateService() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: CreateServiceRequest) => {
      if (!user?.account_id) throw new Error('No account');

      const { data: service, error } = await supabase
        .from('services')
        .insert({
          account_id: user.account_id,
          ...data,
        })
        .select()
        .single();

      if (error) throw error;
      return service as Service;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast.success('Service created');
    },
    onError: (error) => {
      toast.error('Failed to create service', { description: error.message });
    },
  });
}

/**
 * Update an existing service
 */
export function useUpdateService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateServiceRequest) => {
      const { data: service, error } = await supabase
        .from('services')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return service as Service;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast.success('Service updated');
    },
    onError: (error) => {
      toast.error('Failed to update service', { description: error.message });
    },
  });
}

/**
 * Delete a service
 */
export function useDeleteService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (serviceId: string) => {
      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', serviceId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast.success('Service deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete service', { description: error.message });
    },
  });
}

/**
 * Toggle service active status
 */
export function useToggleServiceStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { data: service, error } = await supabase
        .from('services')
        .update({ is_active })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return service as Service;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast.success(data.is_active ? 'Service activated' : 'Service deactivated');
    },
    onError: (error) => {
      toast.error('Failed to update service', { description: error.message });
    },
  });
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Format price in cents to display string
 */
export function formatPrice(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

/**
 * Format duration in minutes to display string
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/**
 * Get category config for display
 */
export function getCategoryConfig(category: string) {
  const configs: Record<string, { label: string; color: string }> = {
    routine: { label: 'Routine', color: 'bg-slate-100 text-slate-700' },
    emergency: { label: 'Emergency', color: 'bg-red-100 text-red-700' },
    maintenance: { label: 'Maintenance', color: 'bg-blue-100 text-blue-700' },
    consultation: { label: 'Consultation', color: 'bg-purple-100 text-purple-700' },
    specialty: { label: 'Specialty', color: 'bg-amber-100 text-amber-700' },
  };
  return configs[category] || { label: category, color: 'bg-gray-100 text-gray-700' };
}
