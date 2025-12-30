import { TestUser } from './test-client';

export function generateTestUser(suffix?: string): TestUser {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  const uniqueId = suffix || `${timestamp}${random}`;

  return {
    id: '',
    email: `test-${uniqueId}@example.com`,
    password: 'TestPassword123!',
    name: 'Test User',
    organizationName: 'Test Organization',
    phone: '+15551234567',
  };
}

export const TEST_PLANS = {
  CORE: 'core',
  GROWTH: 'growth',
  PRO: 'pro',
  BUSINESS: 'business',
} as const;

export const EXPECTED_CREDITS = {
  core: 250,
  growth: 600,
  pro: 1400,
  business: 3000,
} as const;

// Expected feature flags per plan (from subscription_tiers table)
export const EXPECTED_FEATURES = {
  core: {
    has_custom_agent: false,
    has_custom_ai_training: false,
    has_voice_selection: false,
    has_outbound_reminders: false,
    has_call_recordings: true,
    has_api_access: false,
    has_priority_support: false,
    has_sla_guarantee: false,
    has_hipaa_compliance: false,
    has_multi_language: false,
  },
  growth: {
    has_custom_agent: true,
    has_custom_ai_training: false,
    has_voice_selection: false,
    has_outbound_reminders: false,
    has_call_recordings: true,
    has_api_access: false,
    has_priority_support: true,
    has_sla_guarantee: false,
    has_hipaa_compliance: false,
    has_multi_language: false,
  },
  pro: {
    has_custom_agent: true,
    has_custom_ai_training: true,
    has_voice_selection: false,
    has_outbound_reminders: true,
    has_call_recordings: true,
    has_api_access: false,
    has_priority_support: true,
    has_sla_guarantee: false,
    has_hipaa_compliance: false,
    has_multi_language: false,
  },
  business: {
    has_custom_agent: true,
    has_custom_ai_training: true,
    has_voice_selection: true,
    has_outbound_reminders: true,
    has_call_recordings: true,
    has_api_access: true,
    has_priority_support: true,
    has_sla_guarantee: false,
    has_hipaa_compliance: false,
    has_multi_language: true,
  },
} as const;

export type PlanFeatures = typeof EXPECTED_FEATURES[keyof typeof EXPECTED_FEATURES];
