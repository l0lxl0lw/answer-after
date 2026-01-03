// Subscription hooks
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { DEFAULT_PLAN } from '@/lib/constants';

export function useSubscription() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['subscription', user?.account_id],
    queryFn: async () => {
      if (!user?.account_id) return null;

      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('account_id', user.account_id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.account_id,
  });
}

export interface SubscriptionTier {
  id: string;
  plan_id: string;
  name: string;
  description: string;
  price_cents: number;
  credits: number;
  sms_limit: number;
  phone_lines: number;
  features: string[];
  has_custom_agent: boolean;
  has_outbound_reminders: boolean;
  has_priority_support: boolean;
  has_api_access: boolean;
  has_call_recordings: boolean;
  has_sla_guarantee: boolean;
  has_hipaa_compliance: boolean;
  has_custom_ai_training: boolean;
  has_multi_language: boolean;
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

/**
 * Hook to get the current user's subscription tier with all feature flags.
 * Combines subscription data with tier details for feature gating.
 */
export function useCurrentSubscriptionTier() {
  const { user } = useAuth();
  const { data: subscription, isLoading: isLoadingSubscription } = useSubscription();
  const { data: tiers, isLoading: isLoadingTiers } = useSubscriptionTiers();

  const currentPlanId = subscription?.plan || DEFAULT_PLAN;
  const currentTier = tiers?.find(t => t.plan_id === currentPlanId) || null;

  return {
    subscription,
    currentTier,
    currentPlanId,
    isLoading: isLoadingSubscription || isLoadingTiers,
    // Convenience accessors for feature flags (with safe defaults)
    features: {
      hasCustomAgent: currentTier?.has_custom_agent ?? false,
      hasOutboundReminders: currentTier?.has_outbound_reminders ?? false,
      hasCallRecordings: currentTier?.has_call_recordings ?? true,
      hasApiAccess: currentTier?.has_api_access ?? false,
      hasPrioritySupport: currentTier?.has_priority_support ?? false,
      hasCustomAiTraining: currentTier?.has_custom_ai_training ?? false,
      hasSlaGuarantee: currentTier?.has_sla_guarantee ?? false,
      hasHipaaCompliance: currentTier?.has_hipaa_compliance ?? false,
      hasMultiLanguage: currentTier?.has_multi_language ?? false,
      credits: currentTier?.credits ?? 250,
    },
  };
}
