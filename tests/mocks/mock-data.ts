import type { SubscriptionTier } from '@/hooks/use-api';

// Mock subscription tiers matching the database schema
export const mockSubscriptionTiers: SubscriptionTier[] = [
  {
    id: 'tier-1',
    plan_id: 'core',
    name: 'Core',
    description: 'Perfect for getting started',
    price_cents: 2900,
    credits: 250,
    features: ['AI call answering', 'Appointment booking', 'SMS notifications', 'Basic support'],
    phone_lines: 1,
    has_custom_agent: false,
    has_outbound_reminders: false,
    has_priority_support: false,
    has_api_access: false,
    has_call_recordings: false,
    has_sla_guarantee: false,
    has_hipaa_compliance: false,
    has_custom_ai_training: false,
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
    price_cents: 7900,
    credits: 600,
    features: ['Custom greeting', 'Service configuration', 'Priority support', 'Call recordings'],
    phone_lines: 2,
    has_custom_agent: true,
    has_outbound_reminders: true,
    has_priority_support: true,
    has_api_access: false,
    has_call_recordings: true,
    has_sla_guarantee: false,
    has_hipaa_compliance: false,
    has_custom_ai_training: false,
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
    price_cents: 14900,
    credits: 1400,
    features: ['Custom instructions', 'API access', 'Dedicated support', 'Advanced analytics'],
    phone_lines: 5,
    has_custom_agent: true,
    has_outbound_reminders: true,
    has_priority_support: true,
    has_api_access: true,
    has_call_recordings: true,
    has_sla_guarantee: false,
    has_hipaa_compliance: false,
    has_custom_ai_training: true,
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
    price_cents: 29900,
    credits: 3000,
    features: ['HIPAA compliance', 'Custom AI training', 'SLA guarantee', 'White-label option'],
    phone_lines: 10,
    has_custom_agent: true,
    has_outbound_reminders: true,
    has_priority_support: true,
    has_api_access: true,
    has_call_recordings: true,
    has_sla_guarantee: true,
    has_hipaa_compliance: true,
    has_custom_ai_training: true,
    support_level: 'enterprise',
    is_popular: false,
    is_active: true,
    is_visible: true,
    display_order: 4,
    stripe_monthly_price_id: 'price_business_monthly',
  },
];

// Mock enterprise tier (should be filtered out)
export const mockEnterpriseTier: SubscriptionTier = {
  id: 'tier-5',
  plan_id: 'enterprise',
  name: 'Enterprise',
  description: 'Custom solutions',
  price_cents: -1,
  credits: 10000,
  features: ['Everything in Business', 'Custom integrations', 'Dedicated account manager'],
  phone_lines: 100,
  has_custom_agent: true,
  has_outbound_reminders: true,
  has_priority_support: true,
  has_api_access: true,
  has_call_recordings: true,
  has_sla_guarantee: true,
  has_hipaa_compliance: true,
  has_custom_ai_training: true,
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
  name: 'Plumbing Repair',
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
