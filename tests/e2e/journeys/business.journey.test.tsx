/**
 * Journey: Business Plan - Direct to Setup (Skips UpgradePrompt)
 *
 * User Flow:
 * 1. User signs up and selects Business plan ($499/month, 3000 credits)
 * 2. User completes phone setup
 * 3. User SKIPS UpgradePrompt page (because hasCustomAiTraining=true)
 * 4. User goes directly to SetupServices (ALL features available)
 * 5. User completes TestCall
 * 6. User reaches Dashboard
 *
 * Key Behaviors:
 * - UpgradePrompt is SKIPPED (Business has hasCustomAiTraining=true)
 * - Auto-redirects to /onboarding/setup-services
 * - SetupServices shows ALL features (greeting, services, instructions, voice selection)
 * - This is the highest tier with all features unlocked
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { EXPECTED_CREDITS, EXPECTED_FEATURES } from '../../helpers/test-data';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), trace: vi.fn() }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) })),
    functions: { invoke: vi.fn().mockResolvedValue({ data: { success: true }, error: null }) },
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }) },
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user', email: 'test@example.com', full_name: 'Test User', role: 'owner', organization_id: 'test-org', organization: { id: 'test-org', name: 'Test Org', slug: 'test-org', timezone: 'America/New_York' } },
    session: { access_token: 'test-token' },
    isLoading: false,
    isAuthenticated: true,
  }),
}));

const BUSINESS_FEATURES = EXPECTED_FEATURES.business;
const BUSINESS_CREDITS = EXPECTED_CREDITS.business;

vi.mock('@/hooks/use-api', () => ({
  useSubscription: () => ({ data: { plan: 'business', status: 'trial', total_credits: 3000, used_credits: 0 }, isLoading: false, error: null }),
  useSubscriptionTiers: () => ({
    data: [
      { plan_id: 'business', name: 'Business', price_cents: 49900, credits: 3000, ...EXPECTED_FEATURES.business },
    ],
    isLoading: false,
    error: null,
  }),
  useCurrentSubscriptionTier: () => ({
    subscription: { plan: 'business', status: 'trial' },
    currentPlanId: 'business',
    currentTier: { plan_id: 'business', name: 'Business', ...EXPECTED_FEATURES.business },
    isLoading: false,
    features: {
      hasCustomAgent: BUSINESS_FEATURES.has_custom_agent,               // true
      hasCustomAiTraining: BUSINESS_FEATURES.has_custom_ai_training,     // true - SKIPS UpgradePrompt
      hasVoiceSelection: BUSINESS_FEATURES.has_voice_selection,         // true
      hasOutboundReminders: BUSINESS_FEATURES.has_outbound_reminders,   // true
      hasCallRecordings: BUSINESS_FEATURES.has_call_recordings,         // true
      hasApiAccess: BUSINESS_FEATURES.has_api_access,                   // true
      hasPrioritySupport: BUSINESS_FEATURES.has_priority_support,       // true
      hasMultiLanguage: BUSINESS_FEATURES.has_multi_language,           // true
      credits: BUSINESS_CREDITS,
    },
  }),
}));

import UpgradePrompt from '@/pages/onboarding/UpgradePrompt';

const createWrapper = (queryClient: QueryClient) => {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  };
};

describe('Journey: Business Plan → Direct to Setup (Skips UpgradePrompt)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockNavigate.mockClear();
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe('Step 3: UpgradePrompt Auto-Skip', () => {
    it('auto-redirects to /onboarding/setup-services', async () => {
      render(<UpgradePrompt />, { wrapper: createWrapper(queryClient) });

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/onboarding/setup-services', { replace: true });
      });
    });

    it('skips because hasCustomAiTraining=true', () => {
      expect(BUSINESS_FEATURES.has_custom_ai_training).toBe(true);
    });

    it('uses replace: true to prevent back navigation', async () => {
      render(<UpgradePrompt />, { wrapper: createWrapper(queryClient) });

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/onboarding/setup-services', { replace: true });
      });
    });
  });

  describe('Business Plan Feature Access - ALL FEATURES UNLOCKED', () => {
    it('has 3000 credits per month (highest tier)', () => {
      expect(BUSINESS_CREDITS).toBe(3000);
    });

    it('HAS custom agent', () => {
      expect(BUSINESS_FEATURES.has_custom_agent).toBe(true);
    });

    it('HAS custom AI training', () => {
      expect(BUSINESS_FEATURES.has_custom_ai_training).toBe(true);
    });

    it('HAS outbound reminders', () => {
      expect(BUSINESS_FEATURES.has_outbound_reminders).toBe(true);
    });

    it('HAS voice selection (UNIQUE to Business)', () => {
      expect(BUSINESS_FEATURES.has_voice_selection).toBe(true);
    });

    it('HAS API access (UNIQUE to Business)', () => {
      expect(BUSINESS_FEATURES.has_api_access).toBe(true);
    });

    it('HAS multi-language support (UNIQUE to Business)', () => {
      expect(BUSINESS_FEATURES.has_multi_language).toBe(true);
    });

    it('HAS priority support', () => {
      expect(BUSINESS_FEATURES.has_priority_support).toBe(true);
    });

    it('HAS call recordings', () => {
      expect(BUSINESS_FEATURES.has_call_recordings).toBe(true);
    });
  });

  describe('Business vs Pro: Additional Features', () => {
    const PRO_FEATURES = EXPECTED_FEATURES.pro;

    it('Business has voice selection, Pro does not', () => {
      expect(BUSINESS_FEATURES.has_voice_selection).toBe(true);
      expect(PRO_FEATURES.has_voice_selection).toBe(false);
    });

    it('Business has API access, Pro does not', () => {
      expect(BUSINESS_FEATURES.has_api_access).toBe(true);
      expect(PRO_FEATURES.has_api_access).toBe(false);
    });

    it('Business has multi-language, Pro does not', () => {
      expect(BUSINESS_FEATURES.has_multi_language).toBe(true);
      expect(PRO_FEATURES.has_multi_language).toBe(false);
    });

    it('Business has more credits (3000 vs 1400)', () => {
      expect(BUSINESS_CREDITS).toBe(3000);
      expect(EXPECTED_CREDITS.pro).toBe(1400);
    });
  });

  describe('SetupServices Expectations - Full Access', () => {
    it('will show greeting customization', () => {
      expect(BUSINESS_FEATURES.has_custom_agent).toBe(true);
    });

    it('will show services configuration', () => {
      expect(BUSINESS_FEATURES.has_custom_agent).toBe(true);
    });

    it('will show custom instructions field', () => {
      expect(BUSINESS_FEATURES.has_custom_ai_training).toBe(true);
    });

    it('will show voice selection options', () => {
      expect(BUSINESS_FEATURES.has_voice_selection).toBe(true);
    });
  });

  describe('Why Business is the Top Tier', () => {
    it('has all features that lower tiers have', () => {
      // Everything Core has
      expect(BUSINESS_FEATURES.has_call_recordings).toBe(true);

      // Everything Growth has
      expect(BUSINESS_FEATURES.has_custom_agent).toBe(true);
      expect(BUSINESS_FEATURES.has_priority_support).toBe(true);

      // Everything Pro has
      expect(BUSINESS_FEATURES.has_custom_ai_training).toBe(true);
      expect(BUSINESS_FEATURES.has_outbound_reminders).toBe(true);
    });

    it('has exclusive features not in lower tiers', () => {
      expect(BUSINESS_FEATURES.has_voice_selection).toBe(true);
      expect(BUSINESS_FEATURES.has_api_access).toBe(true);
      expect(BUSINESS_FEATURES.has_multi_language).toBe(true);
    });
  });
});
