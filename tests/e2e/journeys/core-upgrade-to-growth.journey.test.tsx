/**
 * Journey: Core Plan → Upgrade to Growth
 *
 * User Flow:
 * 1. User signs up and selects Core plan ($29/month, 250 credits)
 * 2. User completes phone setup
 * 3. User sees UpgradePrompt page (because hasCustomAiTraining=false)
 * 4. User clicks "Upgrade to Growth" button
 * 5. User is redirected to /dashboard/subscriptions to complete upgrade
 * 6. After upgrade, user has Growth features (custom agent, priority support)
 *
 * Key Behaviors:
 * - UpgradePrompt IS shown (Core doesn't have hasCustomAiTraining)
 * - User chooses to upgrade to next tier (Growth)
 * - Redirects to subscriptions page for payment/upgrade flow
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { EXPECTED_CREDITS, EXPECTED_FEATURES } from '../../helpers/test-data';

// Mock navigate
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

// Core plan mock data (user is currently on Core)
const CORE_FEATURES = EXPECTED_FEATURES.core;
const GROWTH_FEATURES = EXPECTED_FEATURES.growth;

vi.mock('@/hooks/use-api', () => ({
  useSubscription: () => ({ data: { plan: 'core', status: 'trial', total_credits: 250, used_credits: 0 }, isLoading: false, error: null }),
  useSubscriptionTiers: () => ({
    data: [
      { plan_id: 'core', name: 'Core', price_cents: 2900, credits: 250, ...EXPECTED_FEATURES.core },
      { plan_id: 'growth', name: 'Growth', price_cents: 9900, credits: 600, ...EXPECTED_FEATURES.growth },
    ],
    isLoading: false,
    error: null,
  }),
  useCurrentSubscriptionTier: () => ({
    subscription: { plan: 'core', status: 'trial' },
    currentPlanId: 'core',
    currentTier: { plan_id: 'core', name: 'Core', ...EXPECTED_FEATURES.core },
    isLoading: false,
    features: {
      hasCustomAgent: false,
      hasCustomAiTraining: false,
      hasVoiceSelection: false,
      hasOutboundReminders: false,
      hasCallRecordings: true,
      hasApiAccess: false,
      hasPrioritySupport: false,
      credits: 250,
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

describe('Journey: Core Plan → Upgrade to Growth', () => {
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
    it('shows upgrade option to Growth plan', async () => {
      render(<UpgradePrompt />, { wrapper: createWrapper(queryClient) });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Upgrade to Growth/i })).toBeInTheDocument();
      });
    });

    it('displays Growth as the recommended upgrade', async () => {
      render(<UpgradePrompt />, { wrapper: createWrapper(queryClient) });

      await waitFor(() => {
        expect(screen.getByText('Growth')).toBeInTheDocument();
      });
    });
  });

  describe('User Action: Click "Upgrade to Growth"', () => {
    it('navigates to /dashboard/subscriptions', async () => {
      render(<UpgradePrompt />, { wrapper: createWrapper(queryClient) });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Upgrade to Growth/i })).toBeInTheDocument();
      });

      // User clicks "Upgrade to Growth"
      await user.click(screen.getByRole('button', { name: /Upgrade to Growth/i }));

      // Should navigate to subscriptions page for upgrade flow
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard/subscriptions');
    });

    it('does NOT navigate to setup-services', async () => {
      render(<UpgradePrompt />, { wrapper: createWrapper(queryClient) });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Upgrade to Growth/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Upgrade to Growth/i }));

      // Should NOT go directly to setup-services
      expect(mockNavigate).not.toHaveBeenCalledWith('/onboarding/setup-services');
    });
  });

  describe('Upgrade Benefits: Core → Growth', () => {
    it('gains custom agent feature (hasCustomAgent: false → true)', () => {
      expect(CORE_FEATURES.has_custom_agent).toBe(false);
      expect(GROWTH_FEATURES.has_custom_agent).toBe(true);
    });

    it('gains priority support (hasPrioritySupport: false → true)', () => {
      expect(CORE_FEATURES.has_priority_support).toBe(false);
      expect(GROWTH_FEATURES.has_priority_support).toBe(true);
    });

    it('gains more credits (250 → 600)', () => {
      expect(EXPECTED_CREDITS.core).toBe(250);
      expect(EXPECTED_CREDITS.growth).toBe(600);
    });

    it('still does NOT have custom AI training', () => {
      // Growth still doesn't have this - need Pro for that
      expect(GROWTH_FEATURES.has_custom_ai_training).toBe(false);
    });

    it('still does NOT have voice selection', () => {
      // Need Business for that
      expect(GROWTH_FEATURES.has_voice_selection).toBe(false);
    });
  });

  describe('Plan Hierarchy', () => {
    it('Core is below Growth in hierarchy', () => {
      const hierarchy = ['core', 'growth', 'pro', 'business'];
      expect(hierarchy.indexOf('core')).toBeLessThan(hierarchy.indexOf('growth'));
    });

    it('upgrade target is exactly one tier up', () => {
      const hierarchy = ['core', 'growth', 'pro', 'business'];
      const currentIndex = hierarchy.indexOf('core');
      const upgradeTarget = hierarchy[currentIndex + 1];
      expect(upgradeTarget).toBe('growth');
    });
  });
});
