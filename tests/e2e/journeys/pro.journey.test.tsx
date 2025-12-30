/**
 * Journey: Pro Plan - Shows Upgrade to Business
 *
 * User Flow:
 * 1. User signs up and selects Pro plan ($199/month, 1400 credits)
 * 2. User completes phone setup
 * 3. User sees UpgradePrompt page with option to upgrade to Business
 * 4. User can choose "Continue with Pro" or "Upgrade to Business"
 * 5. User proceeds to SetupServices or Subscriptions page
 *
 * Key Behaviors:
 * - UpgradePrompt IS shown (Pro is not top tier)
 * - Shows "Continue with Pro" button
 * - Shows "Upgrade to Business" button with NEW features gained
 * - Features shown: Voice selection, API access, Multi-language (features Pro doesn't have)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

const PRO_FEATURES = EXPECTED_FEATURES.pro;
const BUSINESS_FEATURES = EXPECTED_FEATURES.business;
const PRO_CREDITS = EXPECTED_CREDITS.pro;
const BUSINESS_CREDITS = EXPECTED_CREDITS.business;

vi.mock('@/hooks/use-api', () => ({
  useSubscription: () => ({ data: { plan: 'pro', status: 'trial', total_credits: 1400, used_credits: 0 }, isLoading: false, error: null }),
  useSubscriptionTiers: () => ({
    data: [
      {
        plan_id: 'pro',
        name: 'Pro',
        price_cents: 19900,
        credits: 1400,
        features: ['AI call answering', 'Appointment booking', 'SMS notifications', 'Call recordings', 'Custom AI training', 'Outbound reminders'],
        ...EXPECTED_FEATURES.pro
      },
      {
        plan_id: 'business',
        name: 'Business',
        price_cents: 49900,
        credits: 3000,
        features: ['AI call answering', 'Appointment booking', 'SMS notifications', 'Call recordings', 'Custom AI training', 'Outbound reminders', 'Voice selection', 'API access', 'Multi-language support'],
        ...EXPECTED_FEATURES.business
      },
    ],
    isLoading: false,
    error: null,
  }),
  useCurrentSubscriptionTier: () => ({
    subscription: { plan: 'pro', status: 'trial' },
    currentPlanId: 'pro',
    currentTier: {
      plan_id: 'pro',
      name: 'Pro',
      price_cents: 19900,
      credits: 1400,
      features: ['AI call answering', 'Appointment booking', 'SMS notifications', 'Call recordings', 'Custom AI training', 'Outbound reminders'],
      ...EXPECTED_FEATURES.pro
    },
    isLoading: false,
    features: {
      hasCustomAgent: PRO_FEATURES.has_custom_agent,
      hasCustomAiTraining: PRO_FEATURES.has_custom_ai_training,
      hasVoiceSelection: PRO_FEATURES.has_voice_selection,
      hasOutboundReminders: PRO_FEATURES.has_outbound_reminders,
      hasCallRecordings: PRO_FEATURES.has_call_recordings,
      hasApiAccess: PRO_FEATURES.has_api_access,
      hasPrioritySupport: PRO_FEATURES.has_priority_support,
      hasMultiLanguage: PRO_FEATURES.has_multi_language,
      credits: PRO_CREDITS,
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

describe('Journey: Pro Plan → Shows Upgrade to Business', () => {
  let queryClient: QueryClient;
  const user = userEvent.setup();

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockNavigate.mockClear();
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe('Step 3: UpgradePrompt Page (NO auto-skip)', () => {
    it('does NOT auto-redirect (shows UpgradePrompt)', async () => {
      render(<UpgradePrompt />, { wrapper: createWrapper(queryClient) });

      // Pro plan should NOT auto-redirect - wait a tick and verify no navigation
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('shows "Continue with Pro" button', async () => {
      render(<UpgradePrompt />, { wrapper: createWrapper(queryClient) });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Continue with Pro/i })).toBeInTheDocument();
      });
    });

    it('shows "Upgrade to Business" button', async () => {
      render(<UpgradePrompt />, { wrapper: createWrapper(queryClient) });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Upgrade to Business/i })).toBeInTheDocument();
      });
    });

    it('displays Business plan name', async () => {
      render(<UpgradePrompt />, { wrapper: createWrapper(queryClient) });

      await waitFor(() => {
        expect(screen.getByText('Business')).toBeInTheDocument();
      });
    });
  });

  describe('User Action: Click "Continue with Pro"', () => {
    it('navigates to /onboarding/setup-services', async () => {
      render(<UpgradePrompt />, { wrapper: createWrapper(queryClient) });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Continue with Pro/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Continue with Pro/i }));

      expect(mockNavigate).toHaveBeenCalledWith('/onboarding/setup-services');
    });
  });

  describe('User Action: Click "Upgrade to Business"', () => {
    it('navigates to /dashboard/subscriptions', async () => {
      render(<UpgradePrompt />, { wrapper: createWrapper(queryClient) });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Upgrade to Business/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Upgrade to Business/i }));

      expect(mockNavigate).toHaveBeenCalledWith('/dashboard/subscriptions');
    });
  });

  describe('Upgrade Benefits: Pro → Business', () => {
    it('Business has voice selection, Pro does not', () => {
      expect(PRO_FEATURES.has_voice_selection).toBe(false);
      expect(BUSINESS_FEATURES.has_voice_selection).toBe(true);
    });

    it('Business has API access, Pro does not', () => {
      expect(PRO_FEATURES.has_api_access).toBe(false);
      expect(BUSINESS_FEATURES.has_api_access).toBe(true);
    });

    it('Business has multi-language, Pro does not', () => {
      expect(PRO_FEATURES.has_multi_language).toBe(false);
      expect(BUSINESS_FEATURES.has_multi_language).toBe(true);
    });

    it('Business has more credits (3000 vs 1400)', () => {
      expect(PRO_CREDITS).toBe(1400);
      expect(BUSINESS_CREDITS).toBe(3000);
    });
  });

  describe('Pro Plan Feature Access', () => {
    it('has 1400 credits per month', () => {
      expect(PRO_CREDITS).toBe(1400);
    });

    it('HAS custom agent (hasCustomAgent=true)', () => {
      expect(PRO_FEATURES.has_custom_agent).toBe(true);
    });

    it('HAS custom AI training (hasCustomAiTraining=true)', () => {
      expect(PRO_FEATURES.has_custom_ai_training).toBe(true);
    });

    it('HAS outbound reminders (hasOutboundReminders=true)', () => {
      expect(PRO_FEATURES.has_outbound_reminders).toBe(true);
    });

    it('HAS priority support', () => {
      expect(PRO_FEATURES.has_priority_support).toBe(true);
    });

    it('does NOT have voice selection (need Business)', () => {
      expect(PRO_FEATURES.has_voice_selection).toBe(false);
    });

    it('does NOT have API access (need Business)', () => {
      expect(PRO_FEATURES.has_api_access).toBe(false);
    });

    it('does NOT have multi-language (need Business)', () => {
      expect(PRO_FEATURES.has_multi_language).toBe(false);
    });
  });

  describe('Why Pro Shows UpgradePrompt', () => {
    it('Pro is not the top tier - Business is higher', () => {
      const hierarchy = ['core', 'growth', 'pro', 'business'];
      expect(hierarchy.indexOf('pro')).toBeLessThan(hierarchy.indexOf('business'));
    });

    it('Business has exclusive features Pro does not have', () => {
      expect(BUSINESS_FEATURES.has_voice_selection).toBe(true);
      expect(BUSINESS_FEATURES.has_api_access).toBe(true);
      expect(BUSINESS_FEATURES.has_multi_language).toBe(true);
    });
  });
});
