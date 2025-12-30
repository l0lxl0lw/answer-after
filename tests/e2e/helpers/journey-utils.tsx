/**
 * Shared utilities for E2E journey tests
 *
 * Provides common mocking setup and helpers used across all journey test files.
 */

import React from 'react';
import { vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { EXPECTED_CREDITS, EXPECTED_FEATURES } from '../../helpers/test-data';

// Navigation mock - shared across all journey tests
export const mockNavigate = vi.fn();

// Create QueryClient for tests
export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });

// Create test wrapper
export const createWrapper = (queryClient: QueryClient) => {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  };
};

// Mock data holders - these get set by setupMockDataForPlan
export let mockSubscriptionData: any = null;
export let mockTiersData: any[] = [];
export let mockCurrentTierData: any = null;

// All subscription tiers for reference
export const ALL_TIERS = [
  { plan_id: 'core', name: 'Core', price_cents: 2900, credits: 250, ...EXPECTED_FEATURES.core },
  { plan_id: 'growth', name: 'Growth', price_cents: 9900, credits: 600, ...EXPECTED_FEATURES.growth },
  { plan_id: 'pro', name: 'Pro', price_cents: 19900, credits: 1400, ...EXPECTED_FEATURES.pro },
  { plan_id: 'business', name: 'Business', price_cents: 49900, credits: 3000, ...EXPECTED_FEATURES.business },
];

/**
 * Set up mock data for a specific subscription plan
 */
export const setupMockDataForPlan = (plan: keyof typeof EXPECTED_FEATURES) => {
  const features = EXPECTED_FEATURES[plan];
  const credits = EXPECTED_CREDITS[plan];

  mockSubscriptionData = {
    plan,
    status: 'trial',
    total_credits: credits,
    used_credits: 0,
  };

  mockTiersData = ALL_TIERS;

  mockCurrentTierData = {
    subscription: mockSubscriptionData,
    currentPlanId: plan,
    currentTier: { plan_id: plan, name: plan.charAt(0).toUpperCase() + plan.slice(1), ...features },
    isLoading: false,
    features: {
      hasCustomAgent: features.has_custom_agent,
      hasOutboundReminders: features.has_outbound_reminders,
      hasCallRecordings: features.has_call_recordings,
      hasApiAccess: features.has_api_access,
      hasPrioritySupport: features.has_priority_support,
      hasCustomAiTraining: features.has_custom_ai_training,
      hasSlaGuarantee: features.has_sla_guarantee,
      hasHipaaCompliance: features.has_hipaa_compliance,
      hasVoiceSelection: features.has_voice_selection,
      hasMultiLanguage: features.has_multi_language,
      credits,
    },
  };
};

/**
 * Reset mock data to initial state
 */
export const resetMockData = () => {
  mockSubscriptionData = null;
  mockTiersData = [];
  mockCurrentTierData = null;
};

/**
 * Get mock data getters for vi.mock
 */
export const getMockDataGetters = () => ({
  getSubscriptionData: () => mockSubscriptionData,
  getTiersData: () => mockTiersData,
  getCurrentTierData: () => mockCurrentTierData,
});
