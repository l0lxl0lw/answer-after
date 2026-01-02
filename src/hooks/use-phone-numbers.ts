// Phone number hooks
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export function usePhoneNumbers() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['phone-numbers', user?.institution_id],
    queryFn: async () => {
      if (!user?.institution_id) return [];

      const { data, error } = await supabase
        .from('phone_numbers')
        .select('*')
        .eq('institution_id', user.institution_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.institution_id,
  });
}
