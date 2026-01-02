// Institution hook
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export function useInstitution() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['institution', user?.institution_id],
    queryFn: async () => {
      if (!user?.institution_id) return null;

      const { data, error } = await supabase
        .from('institutions')
        .select('*')
        .eq('id', user.institution_id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.institution_id,
  });
}
