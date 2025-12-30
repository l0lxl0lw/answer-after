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

describe('SelectPlan UI', () => {
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

    // Default function response
    mockFunctionsInvoke.mockResolvedValue({
      data: { url: 'https://checkout.stripe.com/session' },
      error: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Loading State', () => {
    it('renders loading spinner when tiers are loading', () => {
      mockUseSubscriptionTiers.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      });

      render(<SelectPlan />, { wrapper: createWrapper() });

      expect(document.querySelector('.animate-spin')).toBeTruthy();
    });
  });

  describe('Plan Cards Rendering', () => {
    it('renders all 4 plan cards (Core, Growth, Pro, Business)', () => {
      render(<SelectPlan />, { wrapper: createWrapper() });

      expect(screen.getByText('Core')).toBeInTheDocument();
      expect(screen.getByText('Growth')).toBeInTheDocument();
      expect(screen.getByText('Pro')).toBeInTheDocument();
      expect(screen.getByText('Business')).toBeInTheDocument();
    });

    it('displays correct pricing ($29, $79, $149, $299)', () => {
      render(<SelectPlan />, { wrapper: createWrapper() });

      expect(screen.getByText('$29')).toBeInTheDocument();
      expect(screen.getByText('$79')).toBeInTheDocument();
      expect(screen.getByText('$149')).toBeInTheDocument();
      expect(screen.getByText('$299')).toBeInTheDocument();
    });

    it('shows "Most Popular" badge on Growth tier', () => {
      render(<SelectPlan />, { wrapper: createWrapper() });

      expect(screen.getByText('Most Popular')).toBeInTheDocument();
    });

    it('displays credits for each tier', () => {
      render(<SelectPlan />, { wrapper: createWrapper() });

      expect(screen.getByText(/250 credits/)).toBeInTheDocument();
      expect(screen.getByText(/600 credits/)).toBeInTheDocument();
    });

    it('shows $1 first month promo banner', () => {
      render(<SelectPlan />, { wrapper: createWrapper() });

      expect(screen.getByText(/first month is only \$1/i)).toBeInTheDocument();
    });

    it('displays features list with checkmarks', () => {
      render(<SelectPlan />, { wrapper: createWrapper() });

      expect(screen.getByText('AI call answering')).toBeInTheDocument();
      expect(screen.getByText('Appointment booking')).toBeInTheDocument();
    });
  });

  describe('Processing State Display', () => {
    it('shows processing spinner on selected button', async () => {
      mockFunctionsInvoke.mockImplementation(() => new Promise(() => {}));

      render(<SelectPlan />, { wrapper: createWrapper() });

      const coreButton = screen.getByRole('button', { name: /Select Core/i });
      await user.click(coreButton);

      await waitFor(() => {
        expect(screen.getByText(/Processing/i)).toBeInTheDocument();
      });
    });

    it('disables all buttons during processing', async () => {
      mockFunctionsInvoke.mockImplementation(() => new Promise(() => {}));

      render(<SelectPlan />, { wrapper: createWrapper() });

      const coreButton = screen.getByRole('button', { name: /Select Core/i });
      await user.click(coreButton);

      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        buttons.forEach((button) => {
          expect(button).toBeDisabled();
        });
      });
    });

    it('resets button state after error', async () => {
      mockFunctionsInvoke.mockResolvedValue({
        data: null,
        error: { message: 'Checkout failed' },
      });

      render(<SelectPlan />, { wrapper: createWrapper() });

      const coreButton = screen.getByRole('button', { name: /Select Core/i });
      await user.click(coreButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Select Core/i })).not.toBeDisabled();
      });
    });
  });
});
