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
