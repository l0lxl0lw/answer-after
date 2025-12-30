/**
 * Journey: Growth Plan → Upgrade to Pro
 *
 * User Flow:
 * 1. User signs up and selects Growth plan ($99/month, 600 credits)
 * 2. User completes phone setup
 * 3. User sees UpgradePrompt page (because hasCustomAiTraining=false)
 * 4. User clicks "Upgrade to Pro" button
 * 5. User is redirected to /dashboard/subscriptions to complete upgrade
 * 6. After upgrade, user has Pro features (custom AI training, outbound reminders)
 *
 * Key Behaviors:
 * - UpgradePrompt IS shown (Growth doesn't have hasCustomAiTraining)
 * - User chooses to upgrade to Pro tier
 * - Redirects to subscriptions page for payment/upgrade flow
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

const GROWTH_FEATURES = EXPECTED_FEATURES.growth;
const PRO_FEATURES = EXPECTED_FEATURES.pro;

vi.mock('@/hooks/use-api', () => ({
  useSubscription: () => ({ data: { plan: 'growth', status: 'trial', total_credits: 600, used_credits: 0 }, isLoading: false, error: null }),
  useSubscriptionTiers: () => ({
    data: [
      { plan_id: 'growth', name: 'Growth', price_cents: 9900, credits: 600, ...EXPECTED_FEATURES.growth },
      { plan_id: 'pro', name: 'Pro', price_cents: 19900, credits: 1400, ...EXPECTED_FEATURES.pro },
    ],
    isLoading: false,
    error: null,
  }),
  useCurrentSubscriptionTier: () => ({
    subscription: { plan: 'growth', status: 'trial' },
    currentPlanId: 'growth',
    currentTier: { plan_id: 'growth', name: 'Growth', ...EXPECTED_FEATURES.growth },
    isLoading: false,
    features: {
      hasCustomAgent: true,
      hasCustomAiTraining: false,
      hasVoiceSelection: false,
      hasOutboundReminders: false,
      hasCallRecordings: true,
      hasApiAccess: false,
      hasPrioritySupport: true,
      credits: 600,
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

describe('Journey: Growth Plan → Upgrade to Pro', () => {
  let queryClient: QueryClient;
  const user = userEvent.setup();

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockNavigate.mockClear();
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe('Step 3: UpgradePrompt Page', () => {
    it('shows upgrade option to Pro plan', async () => {
      render(<UpgradePrompt />, { wrapper: createWrapper(queryClient) });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Upgrade to Pro/i })).toBeInTheDocument();
      });
    });

    it('displays Pro as the recommended upgrade', async () => {
      render(<UpgradePrompt />, { wrapper: createWrapper(queryClient) });

      await waitFor(() => {
        expect(screen.getByText('Pro')).toBeInTheDocument();
      });
    });
  });

  describe('User Action: Click "Upgrade to Pro"', () => {
    it('navigates to /dashboard/subscriptions', async () => {
      render(<UpgradePrompt />, { wrapper: createWrapper(queryClient) });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Upgrade to Pro/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Upgrade to Pro/i }));

      expect(mockNavigate).toHaveBeenCalledWith('/dashboard/subscriptions');
    });
  });

  describe('Upgrade Benefits: Growth → Pro', () => {
    it('gains custom AI training (hasCustomAiTraining: false → true)', () => {
      expect(GROWTH_FEATURES.has_custom_ai_training).toBe(false);
      expect(PRO_FEATURES.has_custom_ai_training).toBe(true);
    });

    it('gains outbound reminders (hasOutboundReminders: false → true)', () => {
      expect(GROWTH_FEATURES.has_outbound_reminders).toBe(false);
      expect(PRO_FEATURES.has_outbound_reminders).toBe(true);
    });

    it('gains more credits (600 → 1400)', () => {
      expect(EXPECTED_CREDITS.growth).toBe(600);
      expect(EXPECTED_CREDITS.pro).toBe(1400);
    });

    it('still does NOT have voice selection (need Business)', () => {
      expect(PRO_FEATURES.has_voice_selection).toBe(false);
    });

    it('still does NOT have API access (need Business)', () => {
      expect(PRO_FEATURES.has_api_access).toBe(false);
    });

    it('keeps custom agent feature', () => {
      expect(GROWTH_FEATURES.has_custom_agent).toBe(true);
      expect(PRO_FEATURES.has_custom_agent).toBe(true);
    });
  });

  describe('Plan Hierarchy', () => {
    it('Growth is below Pro in hierarchy', () => {
      const hierarchy = ['core', 'growth', 'pro', 'business'];
      expect(hierarchy.indexOf('growth')).toBeLessThan(hierarchy.indexOf('pro'));
    });

    it('upgrade target is exactly one tier up', () => {
      const hierarchy = ['core', 'growth', 'pro', 'business'];
      const currentIndex = hierarchy.indexOf('growth');
      const upgradeTarget = hierarchy[currentIndex + 1];
      expect(upgradeTarget).toBe('pro');
    });
  });
});
