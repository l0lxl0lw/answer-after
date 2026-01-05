import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { isDemoMode } from "@/lib/demo/config";

// Fetch credit configuration
export function useCreditConfig() {
  return useQuery({
    queryKey: ['credit-config'],
    queryFn: async () => {
      if (isDemoMode()) {
        return { inbound_call: 10, outbound_call: 15, sms: 1 };
      }

      const { data, error } = await supabase
        .from('credit_config')
        .select('config_key, config_value, description');

      if (error) throw error;

      // Convert to a map for easy access
      return Object.fromEntries(
        data.map(c => [c.config_key, Number(c.config_value)])
      ) as Record<string, number>;
    },
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
  });
}

// Fetch purchased credits for current organization
export function usePurchasedCredits() {
  return useQuery({
    queryKey: ['purchased-credits'],
    queryFn: async () => {
      if (isDemoMode()) {
        return [{ id: 'demo', credits_remaining: 500, purchased_at: new Date().toISOString() }];
      }

      const { data, error } = await supabase
        .from('purchased_credits')
        .select('*')
        .gt('credits_remaining', 0)
        .order('purchased_at', { ascending: true });

      if (error) throw error;
      return data;
    },
  });
}

export type TopupPackage = 'basic' | 'value' | 'bulk';

// Create credit top-up checkout session
export function useCreateCreditTopup() {
  return useMutation({
    mutationFn: async (packageId: TopupPackage = 'basic') => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke('create-credit-topup', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: { package: packageId },
      });

      if (response.error) throw new Error(response.error.message);
      return response.data as { url: string };
    },
    onError: (error) => {
      toast.error("Failed to start checkout", {
        description: error.message,
      });
    },
  });
}

// Calculate total available credits (subscription + purchased)
export function useTotalAvailableCredits() {
  const { data: purchasedCredits } = usePurchasedCredits();
  
  const purchasedTotal = purchasedCredits?.reduce(
    (sum, pc) => sum + (pc.credits_remaining || 0), 
    0
  ) ?? 0;
  
  return { purchasedCredits: purchasedTotal };
}
