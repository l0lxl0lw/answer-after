import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import {
  mockSubscriptionTiers,
  createMockSession,
  createMockAuthUser,
} from '../../mocks/mock-data';

// Mock navigate function
const mockNavigate = vi.fn();

// Mock Supabase functions.invoke
const mockFunctionsInvoke = vi.fn();

// Create Supabase mock before any imports
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    functions: {
      invoke: (...args: any[]) => mockFunctionsInvoke(...args),
    },
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'test-token' } },
        error: null,
      }),
    },
  },
}));

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock environment
vi.mock('@/lib/environment', () => ({
  shouldSkipStripe: vi.fn(() => false),
  isLocalEnvironment: vi.fn(() => false),
  isDevelopmentMode: vi.fn(() => false),
  isProductionEnvironment: vi.fn(() => true),
}));

// Mock use-api hook
const mockUseSubscriptionTiers = vi.fn();
vi.mock('@/hooks/use-api', () => ({
  useSubscriptionTiers: () => mockUseSubscriptionTiers(),
}));

// Mock AuthContext
const mockSession = createMockSession();
const mockUser = createMockAuthUser();

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    session: mockSession,
    isLoading: false,
    isAuthenticated: true,
  }),
}));

// Mock toast
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Import after all mocks
import SelectPlan from '@/pages/onboarding/SelectPlan';
import { shouldSkipStripe } from '@/lib/environment';

const mockShouldSkipStripe = vi.mocked(shouldSkipStripe);

// Test wrapper
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          {children}
        </MemoryRouter>
      </QueryClientProvider>
    );
  };
};

describe('SelectPlan Functionality', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    mockFunctionsInvoke.mockClear();
    mockToast.mockClear();

    // Default: return subscription tiers
    mockUseSubscriptionTiers.mockReturnValue({
      data: mockSubscriptionTiers,
      isLoading: false,
      error: null,
    });

    // Default: don't skip Stripe
    mockShouldSkipStripe.mockReturnValue(false);

    // Default function response
    mockFunctionsInvoke.mockResolvedValue({
      data: { url: 'https://checkout.stripe.com/session' },
      error: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Stripe Checkout Flow', () => {
    it('calls create-checkout-with-trial edge function on plan select', async () => {
      render(<SelectPlan />, { wrapper: createWrapper() });

      const coreButton = screen.getByRole('button', { name: /Select Core/i });
      await user.click(coreButton);

      await waitFor(() => {
        expect(mockFunctionsInvoke).toHaveBeenCalledWith(
          'create-checkout-with-trial',
          expect.objectContaining({
            body: { planId: 'core' },
          })
        );
      });
    });

    it('passes correct planId in request body for each plan', async () => {
      render(<SelectPlan />, { wrapper: createWrapper() });

      const growthButton = screen.getByRole('button', { name: /Select Growth/i });
      await user.click(growthButton);

      await waitFor(() => {
        expect(mockFunctionsInvoke).toHaveBeenCalledWith(
          'create-checkout-with-trial',
          expect.objectContaining({
            body: { planId: 'growth' },
          })
        );
      });
    });

    it('redirects to Stripe checkout URL on success', async () => {
      const originalLocation = window.location;
      delete (window as any).location;
      window.location = { ...originalLocation, href: '' } as any;

      mockFunctionsInvoke.mockResolvedValue({
        data: { url: 'https://checkout.stripe.com/session' },
        error: null,
      });

      render(<SelectPlan />, { wrapper: createWrapper() });

      const coreButton = screen.getByRole('button', { name: /Select Core/i });
      await user.click(coreButton);

      await waitFor(() => {
        expect(window.location.href).toBe('https://checkout.stripe.com/session');
      });

      window.location = originalLocation;
    });

    it('shows error toast on checkout failure', async () => {
      mockFunctionsInvoke.mockResolvedValue({
        data: null,
        error: { message: 'Checkout failed' },
      });

      render(<SelectPlan />, { wrapper: createWrapper() });

      const coreButton = screen.getByRole('button', { name: /Select Core/i });
      await user.click(coreButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: 'destructive',
          })
        );
      });
    });
  });

  describe('Development Mode (skipStripe)', () => {
    it('calls provision-organization in dev mode', async () => {
      mockShouldSkipStripe.mockReturnValue(true);
      mockFunctionsInvoke.mockResolvedValue({
        data: { success: true, organizationId: 'org-123' },
        error: null,
      });

      render(<SelectPlan />, { wrapper: createWrapper() });

      const coreButton = screen.getByRole('button', { name: /Select Core/i });
      await user.click(coreButton);

      await waitFor(() => {
        expect(mockFunctionsInvoke).toHaveBeenCalledWith(
          'provision-organization',
          expect.objectContaining({
            body: { planId: 'core' },
          })
        );
      });
    });

    it('redirects to /onboarding/phone after dev provisioning', async () => {
      const originalLocation = window.location;
      delete (window as any).location;
      window.location = { ...originalLocation, href: '' } as any;

      vi.useFakeTimers({ shouldAdvanceTime: true });

      mockShouldSkipStripe.mockReturnValue(true);
      mockFunctionsInvoke.mockResolvedValue({
        data: { success: true, organizationId: 'org-123' },
        error: null,
      });

      render(<SelectPlan />, { wrapper: createWrapper() });

      const coreButton = screen.getByRole('button', { name: /Select Core/i });
      await user.click(coreButton);

      // The code uses setTimeout before redirect
      vi.advanceTimersByTime(2000);

      await waitFor(() => {
        expect(window.location.href).toBe('/onboarding/phone');
      });

      window.location = originalLocation;
      vi.useRealTimers();
    });

    it('shows error on provisioning failure', async () => {
      mockShouldSkipStripe.mockReturnValue(true);
      mockFunctionsInvoke.mockResolvedValue({
        data: null,
        error: { message: 'Provisioning failed' },
      });

      render(<SelectPlan />, { wrapper: createWrapper() });

      const coreButton = screen.getByRole('button', { name: /Select Core/i });
      await user.click(coreButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: 'destructive',
          })
        );
      });
    });
  });
});
