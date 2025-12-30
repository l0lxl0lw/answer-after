/**
 * Journey: Core Plan - Continue with Current Plan
 *
 * User Flow:
 * 1. User signs up and selects Core plan ($29/month, 250 credits)
 * 2. User completes phone setup
 * 3. User sees UpgradePrompt page with BOTH Growth AND Pro upgrade options
 * 4. User clicks "Continue with Core" button
 * 5. User proceeds to SetupServices (auto-creates default agent)
 * 6. User completes TestCall
 * 7. User reaches Dashboard
 *
 * Key Behaviors:
 * - UpgradePrompt IS shown (Core is lowest tier)
 * - Shows BOTH Growth AND Pro as upgrade options
 * - User can choose to continue without upgrading
 * - SetupServices auto-creates agent (Core has hasCustomAgent=false)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryClient } from '@tanstack/react-query';
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

// Plan mock data
const CORE_FEATURES = EXPECTED_FEATURES.core;
const GROWTH_FEATURES = EXPECTED_FEATURES.growth;
const PRO_FEATURES = EXPECTED_FEATURES.pro;
const CORE_CREDITS = EXPECTED_CREDITS.core;
const GROWTH_CREDITS = EXPECTED_CREDITS.growth;
const PRO_CREDITS = EXPECTED_CREDITS.pro;

vi.mock('@/hooks/use-api', () => ({
  useSubscription: () => ({ data: { plan: 'core', status: 'trial', total_credits: CORE_CREDITS, used_credits: 0 }, isLoading: false, error: null }),
  useSubscriptionTiers: () => ({
    data: [
      {
        plan_id: 'core',
        name: 'Core',
        price_cents: 2900,
        credits: 250,
        features: ['AI call answering', 'Appointment booking', 'SMS notifications', 'Call recordings'],
        ...EXPECTED_FEATURES.core
      },
      {
        plan_id: 'growth',
        name: 'Growth',
        price_cents: 9900,
        credits: 600,
        features: ['AI call answering', 'Appointment booking', 'SMS notifications', 'Call recordings', 'Custom agent', 'Priority support'],
        ...EXPECTED_FEATURES.growth
      },
      {
        plan_id: 'pro',
        name: 'Pro',
        price_cents: 19900,
        credits: 1400,
        features: ['AI call answering', 'Appointment booking', 'SMS notifications', 'Call recordings', 'Custom agent', 'Custom AI training', 'Outbound reminders', 'Priority support'],
        ...EXPECTED_FEATURES.pro
      },
    ],
    isLoading: false,
    error: null,
  }),
  useCurrentSubscriptionTier: () => ({
    subscription: { plan: 'core', status: 'trial' },
    currentPlanId: 'core',
    currentTier: {
      plan_id: 'core',
      name: 'Core',
      price_cents: 2900,
      credits: 250,
      features: ['AI call answering', 'Appointment booking', 'SMS notifications', 'Call recordings'],
      ...CORE_FEATURES
    },
    isLoading: false,
    features: {
      hasCustomAgent: CORE_FEATURES.has_custom_agent,
      hasCustomAiTraining: CORE_FEATURES.has_custom_ai_training,
      hasVoiceSelection: CORE_FEATURES.has_voice_selection,
      hasOutboundReminders: CORE_FEATURES.has_outbound_reminders,
      hasCallRecordings: CORE_FEATURES.has_call_recordings,
      hasApiAccess: CORE_FEATURES.has_api_access,
      hasPrioritySupport: CORE_FEATURES.has_priority_support,
      hasMultiLanguage: CORE_FEATURES.has_multi_language,
      credits: CORE_CREDITS,
    },
  }),
}));

import UpgradePrompt from '@/pages/onboarding/UpgradePrompt';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

const createWrapper = (queryClient: QueryClient) => {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  };
};

describe('Journey: Core Plan → Continue with Core', () => {
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
    it('shows UpgradePrompt because Core is lowest tier', async () => {
      render(<UpgradePrompt />, { wrapper: createWrapper(queryClient) });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Continue with Core/i })).toBeInTheDocument();
      });
    });

    it('displays current plan as Core', async () => {
      render(<UpgradePrompt />, { wrapper: createWrapper(queryClient) });

      await waitFor(() => {
        expect(screen.getByText('Core')).toBeInTheDocument();
      });
    });

    it('shows BOTH Growth AND Pro as upgrade options', async () => {
      render(<UpgradePrompt />, { wrapper: createWrapper(queryClient) });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Upgrade to Growth/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Upgrade to Pro/i })).toBeInTheDocument();
      });
    });

    it('shows Growth plan name', async () => {
      render(<UpgradePrompt />, { wrapper: createWrapper(queryClient) });

      await waitFor(() => {
        expect(screen.getByText('Growth')).toBeInTheDocument();
      });
    });

    it('shows Pro plan name', async () => {
      render(<UpgradePrompt />, { wrapper: createWrapper(queryClient) });

      await waitFor(() => {
        expect(screen.getByText('Pro')).toBeInTheDocument();
      });
    });
  });

  describe('User Action: Click "Continue with Core"', () => {
    it('navigates to /onboarding/setup-services', async () => {
      render(<UpgradePrompt />, { wrapper: createWrapper(queryClient) });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Continue with Core/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Continue with Core/i }));

      expect(mockNavigate).toHaveBeenCalledWith('/onboarding/setup-services');
    });

    it('does NOT navigate to subscriptions page', async () => {
      render(<UpgradePrompt />, { wrapper: createWrapper(queryClient) });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Continue with Core/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Continue with Core/i }));

      expect(mockNavigate).not.toHaveBeenCalledWith('/dashboard/subscriptions');
    });
  });

  describe('User Action: Click "Upgrade to Growth"', () => {
    it('navigates to /dashboard/subscriptions', async () => {
      render(<UpgradePrompt />, { wrapper: createWrapper(queryClient) });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Upgrade to Growth/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Upgrade to Growth/i }));

      expect(mockNavigate).toHaveBeenCalledWith('/dashboard/subscriptions');
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

  describe('Upgrade Benefits: Core → Growth', () => {
    it('gains custom agent (hasCustomAgent: false → true)', () => {
      expect(CORE_FEATURES.has_custom_agent).toBe(false);
      expect(GROWTH_FEATURES.has_custom_agent).toBe(true);
    });

    it('gains priority support (hasPrioritySupport: false → true)', () => {
      expect(CORE_FEATURES.has_priority_support).toBe(false);
      expect(GROWTH_FEATURES.has_priority_support).toBe(true);
    });

    it('gains more credits (250 → 600)', () => {
      expect(CORE_CREDITS).toBe(250);
      expect(GROWTH_CREDITS).toBe(600);
    });
  });

  describe('Upgrade Benefits: Core → Pro', () => {
    it('gains custom agent (hasCustomAgent: false → true)', () => {
      expect(CORE_FEATURES.has_custom_agent).toBe(false);
      expect(PRO_FEATURES.has_custom_agent).toBe(true);
    });

    it('gains custom AI training (hasCustomAiTraining: false → true)', () => {
      expect(CORE_FEATURES.has_custom_ai_training).toBe(false);
      expect(PRO_FEATURES.has_custom_ai_training).toBe(true);
    });

    it('gains outbound reminders (hasOutboundReminders: false → true)', () => {
      expect(CORE_FEATURES.has_outbound_reminders).toBe(false);
      expect(PRO_FEATURES.has_outbound_reminders).toBe(true);
    });

    it('gains priority support (hasPrioritySupport: false → true)', () => {
      expect(CORE_FEATURES.has_priority_support).toBe(false);
      expect(PRO_FEATURES.has_priority_support).toBe(true);
    });

    it('gains more credits (250 → 1400)', () => {
      expect(CORE_CREDITS).toBe(250);
      expect(PRO_CREDITS).toBe(1400);
    });
  });

  describe('Core Plan Feature Access', () => {
    it('has 250 credits per month', () => {
      expect(CORE_CREDITS).toBe(250);
    });

    it('does NOT have custom agent (hasCustomAgent=false)', () => {
      expect(CORE_FEATURES.has_custom_agent).toBe(false);
    });

    it('does NOT have voice selection', () => {
      expect(CORE_FEATURES.has_voice_selection).toBe(false);
    });

    it('does NOT have custom AI training', () => {
      expect(CORE_FEATURES.has_custom_ai_training).toBe(false);
    });

    it('DOES have call recordings', () => {
      expect(CORE_FEATURES.has_call_recordings).toBe(true);
    });
  });
});
