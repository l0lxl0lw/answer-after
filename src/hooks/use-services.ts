// Service hooks
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface Service {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  duration_minutes: number;
  category: string;
  is_active: boolean;
  institution_id: string;
  created_at: string;
}

export function useServices() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['services', user?.institution_id],
    queryFn: async () => {
      if (!user?.institution_id) return [];

      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('institution_id', user.institution_id)
        .order('name');

      if (error) throw error;
      return data as Service[];
    },
    enabled: !!user?.institution_id,
  });
}
