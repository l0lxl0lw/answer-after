/**
 * Journey: Growth Plan - Continue with Current Plan
 *
 * User Flow:
 * 1. User signs up and selects Growth plan ($99/month, 600 credits)
 * 2. User completes phone setup
 * 3. User sees UpgradePrompt page (because hasCustomAiTraining=false)
 * 4. User clicks "Continue with Growth" button
 * 5. User proceeds to SetupServices (can customize greeting & services)
 * 6. User completes TestCall
 * 7. User reaches Dashboard
 *
 * Key Behaviors:
 * - UpgradePrompt IS shown (Growth doesn't have hasCustomAiTraining)
 * - User can choose to continue without upgrading
 * - SetupServices shows customization UI (Growth has hasCustomAgent=true)
 * - But NO custom instructions field (requires hasCustomAiTraining)
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
const GROWTH_CREDITS = EXPECTED_CREDITS.growth;

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
      hasCustomAgent: GROWTH_FEATURES.has_custom_agent,           // true
      hasCustomAiTraining: GROWTH_FEATURES.has_custom_ai_training, // false - shows UpgradePrompt
      hasVoiceSelection: GROWTH_FEATURES.has_voice_selection,     // false
      hasOutboundReminders: GROWTH_FEATURES.has_outbound_reminders, // false
      hasCallRecordings: GROWTH_FEATURES.has_call_recordings,     // true
      hasApiAccess: GROWTH_FEATURES.has_api_access,               // false
      hasPrioritySupport: GROWTH_FEATURES.has_priority_support,   // true
      credits: GROWTH_CREDITS,
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

describe('Journey: Growth Plan → Continue with Growth', () => {
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
    it('shows UpgradePrompt because Growth has hasCustomAiTraining=false', async () => {
      expect(GROWTH_FEATURES.has_custom_ai_training).toBe(false);

      render(<UpgradePrompt />, { wrapper: createWrapper(queryClient) });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Continue with Growth/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Upgrade to Pro/i })).toBeInTheDocument();
      });
    });

    it('displays current plan as Growth', async () => {
      render(<UpgradePrompt />, { wrapper: createWrapper(queryClient) });

      await waitFor(() => {
        expect(screen.getByText('Growth')).toBeInTheDocument();
      });
    });

    it('shows Pro as the upgrade option (not Business)', async () => {
      render(<UpgradePrompt />, { wrapper: createWrapper(queryClient) });

      await waitFor(() => {
        expect(screen.getByText('Pro')).toBeInTheDocument();
      });
    });
  });

  describe('User Action: Click "Continue with Growth"', () => {
    it('navigates to /onboarding/setup-services', async () => {
      render(<UpgradePrompt />, { wrapper: createWrapper(queryClient) });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Continue with Growth/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Continue with Growth/i }));

      expect(mockNavigate).toHaveBeenCalledWith('/onboarding/setup-services');
    });
  });

  describe('Growth Plan Feature Access', () => {
    it('has 600 credits per month', () => {
      expect(GROWTH_CREDITS).toBe(600);
    });

    it('HAS custom agent (hasCustomAgent=true)', () => {
      expect(GROWTH_FEATURES.has_custom_agent).toBe(true);
      // This means SetupServices shows greeting & services customization
    });

    it('HAS priority support', () => {
      expect(GROWTH_FEATURES.has_priority_support).toBe(true);
    });

    it('does NOT have custom AI training', () => {
      expect(GROWTH_FEATURES.has_custom_ai_training).toBe(false);
      // This means custom instructions field is hidden in SetupServices
    });

    it('does NOT have voice selection', () => {
      expect(GROWTH_FEATURES.has_voice_selection).toBe(false);
    });

    it('does NOT have outbound reminders', () => {
      expect(GROWTH_FEATURES.has_outbound_reminders).toBe(false);
    });
  });

  describe('SetupServices Expectations', () => {
    it('will show greeting customization (hasCustomAgent=true)', () => {
      expect(GROWTH_FEATURES.has_custom_agent).toBe(true);
    });

    it('will show services configuration (hasCustomAgent=true)', () => {
      expect(GROWTH_FEATURES.has_custom_agent).toBe(true);
    });

    it('will NOT show custom instructions field (hasCustomAiTraining=false)', () => {
      expect(GROWTH_FEATURES.has_custom_ai_training).toBe(false);
    });
  });
});
