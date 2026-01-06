// Subscription hooks
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { DEFAULT_PLAN } from '@/lib/constants';
import { isDemoMode } from '@/lib/demo/config';
import { mockSubscription } from '@/lib/demo/mockData';

export function useSubscription() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['subscription', user?.account_id],
    queryFn: async () => {
      if (isDemoMode()) {
        return mockSubscription;
      }

      if (!user?.account_id) return null;

      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('account_id', user.account_id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.account_id || isDemoMode(),
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

// Hardcoded subscription tiers for demo mode (matches database structure)
const DEMO_SUBSCRIPTION_TIERS: SubscriptionTier[] = [
  {
    id: '1',
    plan_id: 'starter',
    name: 'Starter',
    description: 'Perfect for solo practices and after-hours coverage',
    price_cents: 4900,
    credits: 6000,
    sms_limit: 0,
    phone_lines: 1,
    features: ['24/7 AI call answering', 'Appointment scheduling', 'Call recordings', 'HIPAA compliant', 'Email notifications', 'Email support'],
    is_popular: false,
    has_custom_agent: false,
    has_outbound_reminders: false,
    has_call_recordings: true,
    has_api_access: false,
    has_priority_support: false,
    has_custom_ai_training: false,
    has_sla_guarantee: false,
    has_hipaa_compliance: false,
    has_voice_selection: false,
    has_multi_language: false,
    support_level: 'email',
    is_active: true,
    is_visible: true,
    display_order: 1,
    stripe_monthly_price_id: null,
  },
  {
    id: '2',
    plan_id: 'growth',
    name: 'Growth',
    description: 'Ideal for small practices with 1-2 dentists',
    price_cents: 9900,
    credits: 12000,
    sms_limit: 250,
    phone_lines: 1,
    features: ['Everything in Starter, plus:', '200 minutes/month', '250 SMS/month', 'Call recordings & transcripts', 'Custom AI greeting'],
    is_popular: false,
    has_custom_agent: true,
    has_outbound_reminders: false,
    has_call_recordings: true,
    has_api_access: false,
    has_priority_support: false,
    has_custom_ai_training: false,
    has_sla_guarantee: false,
    has_hipaa_compliance: false,
    has_voice_selection: false,
    has_multi_language: false,
    support_level: 'email',
    is_active: true,
    is_visible: true,
    display_order: 2,
    stripe_monthly_price_id: null,
  },
  {
    id: '3',
    plan_id: 'pro',
    name: 'Pro',
    description: 'Best for busy practices needing full AI customization',
    price_cents: 19900,
    credits: 30000,
    sms_limit: 500,
    phone_lines: 2,
    features: ['Everything in Growth, plus:', '500 minutes/month', '500 SMS/month', 'Custom AI personality', 'Custom knowledge training', 'Priority support'],
    is_popular: true,
    has_custom_agent: true,
    has_outbound_reminders: false,
    has_call_recordings: true,
    has_api_access: false,
    has_priority_support: true,
    has_custom_ai_training: true,
    has_sla_guarantee: false,
    has_hipaa_compliance: false,
    has_voice_selection: true,
    has_multi_language: false,
    support_level: 'priority',
    is_active: true,
    is_visible: true,
    display_order: 3,
    stripe_monthly_price_id: null,
  },
  {
    id: '4',
    plan_id: 'business',
    name: 'Business',
    description: 'Complete solution for high-volume and multi-location practices',
    price_cents: 49900,
    credits: 72000,
    sms_limit: 2000,
    phone_lines: 5,
    features: ['Everything in Pro, plus:', '1,200 minutes/month', '2,000 SMS/month', 'Outbound appointment reminders', 'Multi-language support', 'Dedicated account manager', 'SLA guarantee'],
    is_popular: false,
    has_custom_agent: true,
    has_outbound_reminders: true,
    has_call_recordings: true,
    has_api_access: false,
    has_priority_support: true,
    has_custom_ai_training: true,
    has_sla_guarantee: false,
    has_hipaa_compliance: false,
    has_voice_selection: true,
    has_multi_language: true,
    support_level: 'dedicated',
    is_active: true,
    is_visible: true,
    display_order: 4,
    stripe_monthly_price_id: null,
  },
  {
    id: '5',
    plan_id: 'enterprise',
    name: 'Enterprise',
    description: 'Custom solution for DSOs and large dental groups',
    price_cents: 0,
    credits: 0,
    sms_limit: -1,
    phone_lines: -1,
    features: ['Everything in Business, plus:', 'Unlimited minutes', 'Unlimited SMS', 'HIPAA compliance', 'Custom integrations', 'White-label options', '24/7 priority support'],
    is_popular: false,
    has_custom_agent: true,
    has_outbound_reminders: true,
    has_call_recordings: true,
    has_api_access: true,
    has_priority_support: true,
    has_custom_ai_training: true,
    has_sla_guarantee: true,
    has_hipaa_compliance: false,
    has_voice_selection: true,
    has_multi_language: true,
    support_level: 'enterprise',
    is_active: true,
    is_visible: true,
    display_order: 5,
    stripe_monthly_price_id: null,
  },
];

export function useSubscriptionTiers() {
  return useQuery({
    queryKey: ['subscription-tiers'],
    queryFn: async () => {
      if (isDemoMode()) {
        return DEMO_SUBSCRIPTION_TIERS;
      }

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
