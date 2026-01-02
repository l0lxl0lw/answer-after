/**
 * Journey: Core Plan - Continue with Current Plan
 *
 * User Flow (NEW):
 * 1. User signs up and selects Core plan ($29/month, 250 credits)
 * 2. User sees UpgradePrompt page with BOTH Growth AND Pro upgrade options
 * 3. User clicks "Continue with Core" button → Stripe checkout
 * 4. After Stripe success → Phone setup
 * 5. User proceeds to Setup (auto-creates default agent)
 * 6. User completes TestCall
 * 7. User reaches Dashboard
 *
 * Key Behaviors:
 * - UpgradePrompt reads plan from URL (?plan=core)
 * - Shows BOTH Growth AND Pro as upgrade options
 * - Continue button triggers Stripe checkout (not navigation)
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

// Mock URL search params - Core plan selected
let mockSearchParams = new URLSearchParams('plan=core');

// Mock Supabase functions invoke
const mockFunctionsInvoke = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [mockSearchParams],
  };
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
    functions: { invoke: (...args: any[]) => mockFunctionsInvoke(...args) },
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
      {
        plan_id: 'business',
        name: 'Business',
        price_cents: 49900,
        credits: 3000,
        features: ['All Pro features', 'API access', 'Multi-language', 'Voice selection'],
        ...EXPECTED_FEATURES.business
      },
    ],
    isLoading: false,
    error: null,
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

describe('Journey: Core Plan → Continue with Core', () => {
  let queryClient: QueryClient;
  const user = userEvent.setup();

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockNavigate.mockClear();
    mockFunctionsInvoke.mockClear();
    mockSearchParams = new URLSearchParams('plan=core');

    // Default: successful checkout
    mockFunctionsInvoke.mockResolvedValue({
      data: { url: 'https://checkout.stripe.com/test' },
      error: null,
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe('Step 2: UpgradePrompt Page', () => {
    it('shows UpgradePrompt because Core is lowest tier', async () => {
      render(<UpgradePrompt />, { wrapper: createWrapper(queryClient) });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Continue with Core/i })).toBeInTheDocument();
      });
    });

    it('displays selected plan as Core', async () => {
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

    it('shows Step 2 of 6', async () => {
      render(<UpgradePrompt />, { wrapper: createWrapper(queryClient) });

      await waitFor(() => {
        expect(screen.getByText(/Step 2 of 6/i)).toBeInTheDocument();
      });
    });
  });

  describe('User Action: Click "Continue with Core"', () => {
    it('calls Stripe checkout with core plan', async () => {
      render(<UpgradePrompt />, { wrapper: createWrapper(queryClient) });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Continue with Core/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Continue with Core/i }));

      await waitFor(() => {
        expect(mockFunctionsInvoke).toHaveBeenCalledWith(
          'create-checkout-with-trial',
          expect.objectContaining({
            body: { planId: 'core' },
          })
        );
      });
    });
  });

  describe('User Action: Click "Upgrade to Growth"', () => {
    it('calls Stripe checkout with growth plan', async () => {
      render(<UpgradePrompt />, { wrapper: createWrapper(queryClient) });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Upgrade to Growth/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Upgrade to Growth/i }));

      await waitFor(() => {
        expect(mockFunctionsInvoke).toHaveBeenCalledWith(
          'create-checkout-with-trial',
          expect.objectContaining({
            body: { planId: 'growth' },
          })
        );
      });
    });
  });

  describe('User Action: Click "Upgrade to Pro"', () => {
    it('calls Stripe checkout with pro plan', async () => {
      render(<UpgradePrompt />, { wrapper: createWrapper(queryClient) });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Upgrade to Pro/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Upgrade to Pro/i }));

      await waitFor(() => {
        expect(mockFunctionsInvoke).toHaveBeenCalledWith(
          'create-checkout-with-trial',
          expect.objectContaining({
            body: { planId: 'pro' },
          })
        );
      });
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
