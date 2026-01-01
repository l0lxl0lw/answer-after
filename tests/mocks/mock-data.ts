import type { SubscriptionTier } from '@/hooks/use-api';

// Mock subscription tiers matching the ACTUAL database schema
// Last verified: 2024-12-30 from local Supabase
export const mockSubscriptionTiers: SubscriptionTier[] = [
  {
    id: 'tier-1',
    plan_id: 'core',
    name: 'Core',
    description: 'Perfect for getting started',
    price_cents: 2900,        // $29/month
    credits: 250,
    features: ['AI call answering', 'Appointment booking', 'SMS notifications', 'Call recordings'],
    has_custom_agent: false,
    has_outbound_reminders: false,
    has_priority_support: false,
    has_api_access: false,
    has_call_recordings: true,  // Core DOES have call recordings
    has_sla_guarantee: false,
    has_hipaa_compliance: false,
    has_custom_ai_training: false,
    has_voice_selection: false,   // Core does NOT have voice selection
    has_multi_language: false,    // Core does NOT have multi-language
    support_level: 'email',
    is_popular: false,
    is_active: true,
    is_visible: true,
    display_order: 1,
    stripe_monthly_price_id: 'price_core_monthly',
  },
  {
    id: 'tier-2',
    plan_id: 'growth',
    name: 'Growth',
    description: 'For growing businesses',
    price_cents: 9900,        // $99/month
    credits: 600,
    features: ['Custom greeting', 'Service configuration', 'Priority support', 'Call recordings'],
    has_custom_agent: true,
    has_outbound_reminders: false,  // Growth does NOT have outbound reminders
    has_priority_support: true,
    has_api_access: false,
    has_call_recordings: true,
    has_sla_guarantee: false,
    has_hipaa_compliance: false,
    has_custom_ai_training: false,
    has_voice_selection: false,   // Growth does NOT have voice selection
    has_multi_language: false,    // Growth does NOT have multi-language
    support_level: 'priority',
    is_popular: true,
    is_active: true,
    is_visible: true,
    display_order: 2,
    stripe_monthly_price_id: 'price_growth_monthly',
  },
  {
    id: 'tier-3',
    plan_id: 'pro',
    name: 'Pro',
    description: 'Advanced features',
    price_cents: 19900,       // $199/month
    credits: 1400,
    features: ['Custom instructions', 'Outbound reminders', 'Dedicated support', 'Custom AI training'],
    has_custom_agent: true,
    has_outbound_reminders: true,   // Pro has outbound reminders
    has_priority_support: true,
    has_api_access: false,          // Pro does NOT have API access
    has_call_recordings: true,
    has_sla_guarantee: false,
    has_hipaa_compliance: false,
    has_custom_ai_training: true,
    has_voice_selection: false,   // Pro does NOT have voice selection
    has_multi_language: false,    // Pro does NOT have multi-language
    support_level: 'dedicated',
    is_popular: false,
    is_active: true,
    is_visible: true,
    display_order: 3,
    stripe_monthly_price_id: 'price_pro_monthly',
  },
  {
    id: 'tier-4',
    plan_id: 'business',
    name: 'Business',
    description: 'Enterprise-ready',
    price_cents: 49900,       // $499/month
    credits: 3000,
    features: ['API access', 'Voice selection', 'Multi-language (2 max)', 'Enterprise support'],
    has_custom_agent: true,
    has_outbound_reminders: true,
    has_priority_support: true,
    has_api_access: true,           // Only Business+ has API access
    has_call_recordings: true,
    has_sla_guarantee: false,       // Business does NOT have SLA guarantee
    has_hipaa_compliance: false,    // Business does NOT have HIPAA
    has_custom_ai_training: true,
    has_voice_selection: true,    // Business has voice selection
    has_multi_language: true,     // Business has multi-language (2 max)
    support_level: 'enterprise',
    is_popular: false,
    is_active: true,
    is_visible: true,
    display_order: 4,
    stripe_monthly_price_id: 'price_business_monthly',
  },
];

// Mock enterprise tier (should be filtered out in UI)
// Last verified: 2024-12-30 from local Supabase
export const mockEnterpriseTier: SubscriptionTier = {
  id: 'tier-5',
  plan_id: 'enterprise',
  name: 'Enterprise',
  description: 'Custom solutions',
  price_cents: 0,            // 0 in DB (custom pricing)
  credits: 0,                // 0 in DB (custom allocation)
  features: ['Everything in Business', 'Custom integrations', 'Dedicated account manager'],
  has_custom_agent: true,
  has_outbound_reminders: true,
  has_priority_support: true,
  has_api_access: true,
  has_call_recordings: true,
  has_sla_guarantee: true,   // Enterprise has SLA
  has_hipaa_compliance: true, // Enterprise has HIPAA
  has_custom_ai_training: true,
  has_voice_selection: true,  // Enterprise has voice selection
  has_multi_language: true,   // Enterprise has multi-language
  support_level: 'enterprise',
  is_popular: false,
  is_active: true,
  is_visible: true,
  display_order: 5,
  stripe_monthly_price_id: null,
};

// Mock subscription data
export interface MockSubscription {
  id: string;
  organization_id: string;
  plan: string;
  status: 'trial' | 'active' | 'pending' | 'past_due' | 'canceled';
  total_credits: number;
  used_credits: number;
  current_period_start: string;
  current_period_end: string;
  stripe_subscription_id: string | null;
}

export const createMockSubscription = (overrides: Partial<MockSubscription> = {}): MockSubscription => ({
  id: 'sub-123',
  organization_id: 'org-123',
  plan: 'core',
  status: 'trial',
  total_credits: 250,
  used_credits: 0,
  current_period_start: new Date().toISOString(),
  current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  stripe_subscription_id: null,
  ...overrides,
});

// Mock phone number
export interface MockPhoneNumber {
  id: string;
  organization_id: string;
  phone_number: string;
  is_active: boolean;
  created_at: string;
}

export const createMockPhoneNumber = (overrides: Partial<MockPhoneNumber> = {}): MockPhoneNumber => ({
  id: 'phone-123',
  organization_id: 'org-123',
  phone_number: '+15551234567',
  is_active: true,
  created_at: new Date().toISOString(),
  ...overrides,
});

// Mock service
export interface MockService {
  id: string;
  organization_id: string;
  name: string;
  price_cents: number;
  duration_minutes: number;
  is_active: boolean;
}

export const createMockService = (overrides: Partial<MockService> = {}): MockService => ({
  id: 'service-123',
  organization_id: 'org-123',
  name: 'Dental Checkup',
  price_cents: 9900,
  duration_minutes: 60,
  is_active: true,
  ...overrides,
});

// Mock organization agent
export interface MockOrganizationAgent {
  id: string;
  organization_id: string;
  elevenlabs_agent_id: string | null;
  context: string | null;
}

export const createMockOrganizationAgent = (overrides: Partial<MockOrganizationAgent> = {}): MockOrganizationAgent => ({
  id: 'agent-123',
  organization_id: 'org-123',
  elevenlabs_agent_id: null,
  context: null,
  ...overrides,
});

// Mock user data for AuthContext
export interface MockAuthUser {
  id: string;
  email: string;
  full_name: string;
  role: 'owner' | 'admin' | 'staff';
  organization_id: string | null;
  organization: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
    business_hours_start: string | null;
    business_hours_end: string | null;
  } | null;
}

export const createMockAuthUser = (overrides: Partial<MockAuthUser> = {}): MockAuthUser => ({
  id: 'user-123',
  email: 'test@example.com',
  full_name: 'Test User',
  role: 'owner',
  organization_id: 'org-123',
  organization: {
    id: 'org-123',
    name: 'Test Organization',
    slug: 'test-org',
    timezone: 'America/New_York',
    business_hours_start: '09:00',
    business_hours_end: '17:00',
  },
  ...overrides,
});

// Mock session
export interface MockSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: {
    id: string;
    email: string;
  };
}

export const createMockSession = (overrides: Partial<MockSession> = {}): MockSession => ({
  access_token: 'test-access-token',
  refresh_token: 'test-refresh-token',
  expires_at: Date.now() + 3600000,
  user: {
    id: 'user-123',
    email: 'test@example.com',
  },
  ...overrides,
});
