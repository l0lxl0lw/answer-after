// Account hook
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { isDemoMode } from '@/lib/demo/config';
import { mockAccount } from '@/lib/demo/mockData';

export function useAccount() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['account', user?.account_id],
    queryFn: async () => {
      if (isDemoMode()) {
        return mockAccount;
      }

      if (!user?.account_id) return null;

      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('id', user.account_id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.account_id || isDemoMode(),
  });
}
