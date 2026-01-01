import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { createMockSession, createMockAuthUser, mockSubscriptionTiers } from '../../mocks/mock-data';

// Mock navigate function
const mockNavigate = vi.fn();

// Mock Supabase functions
const mockFunctionsInvoke = vi.fn();
const mockFromQuery = vi.fn();

// Mock for useCurrentSubscriptionTier hook
let mockCurrentTierData = {
  subscription: { plan: 'growth', status: 'active' },
  currentPlanId: 'growth',
  currentTier: mockSubscriptionTiers[1], // Growth tier
  isLoading: false,
  features: {
    hasCustomAgent: true,        // Growth has this
    hasOutboundReminders: false,
    hasCallRecordings: true,
    hasApiAccess: false,
    hasPrioritySupport: true,
    hasCustomAiTraining: false,  // Growth does NOT have this
    hasSlaGuarantee: false,
    hasHipaaCompliance: false,
    hasVoiceSelection: false,
    hasMultiLanguage: false,
    credits: 600,
  },
};

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: any[]) => mockFromQuery(...args),
    functions: {
      invoke: (...args: any[]) => mockFunctionsInvoke(...args),
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

// Mock use-api hooks
vi.mock('@/hooks/use-api', () => ({
  useCurrentSubscriptionTier: () => mockCurrentTierData,
}));

// Mock AuthContext
const mockSession = createMockSession();
const mockUser = createMockAuthUser();
let mockAuthValue = {
  user: mockUser,
  session: mockSession,
  isLoading: false,
  isAuthenticated: true,
};

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockAuthValue,
}));

// Mock toast
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    trace: vi.fn(),
  }),
}));

// Import after all mocks
import SetupServices from '@/pages/onboarding/SetupServices';

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

// Setup default mock from query chain
const setupMockFromQuery = () => {
  mockFromQuery.mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    insert: vi.fn().mockResolvedValue({ error: null }),
    update: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  });
};

describe('SetupServices UI', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    mockFunctionsInvoke.mockClear();
    mockToast.mockClear();

    // Reset defaults - Growth plan with custom agent but no custom AI training
    mockCurrentTierData = {
      subscription: { plan: 'growth', status: 'active' },
      currentPlanId: 'growth',
      currentTier: mockSubscriptionTiers[1],
      isLoading: false,
      features: {
        hasCustomAgent: true,
        hasOutboundReminders: false,
        hasCallRecordings: true,
        hasApiAccess: false,
        hasPrioritySupport: true,
        hasCustomAiTraining: false,
        hasSlaGuarantee: false,
        hasHipaaCompliance: false,
        hasVoiceSelection: false,
        hasMultiLanguage: false,
        credits: 600,
      },
    };

    mockAuthValue = {
      user: mockUser,
      session: mockSession,
      isLoading: false,
      isAuthenticated: true,
    };

    setupMockFromQuery();

    // Default function response
    mockFunctionsInvoke.mockResolvedValue({
      data: { success: true },
      error: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Loading State', () => {
    it('renders loading spinner when plan is loading', () => {
      mockCurrentTierData = {
        ...mockCurrentTierData,
        isLoading: true,
        currentTier: null,
      };

      render(<SetupServices />, { wrapper: createWrapper() });

      expect(document.querySelector('.animate-spin')).toBeTruthy();
    });
  });

  describe('Growth Plan UI (hasCustomAgent=true, hasCustomAiTraining=false)', () => {
    beforeEach(() => {
      // Growth plan: has custom agent, no custom AI training
      mockCurrentTierData = {
        subscription: { plan: 'growth', status: 'active' },
        currentPlanId: 'growth',
        currentTier: mockSubscriptionTiers[1],
        isLoading: false,
        features: {
          hasCustomAgent: true,
          hasOutboundReminders: false,
          hasCallRecordings: true,
          hasApiAccess: false,
          hasPrioritySupport: true,
          hasCustomAiTraining: false,
          hasSlaGuarantee: false,
          hasHipaaCompliance: false,
          hasVoiceSelection: false,
          hasMultiLanguage: false,
          credits: 600,
        },
      };
    });

    it('displays greeting textarea for Growth plan', async () => {
      render(<SetupServices />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByLabelText(/Custom Greeting/i)).toBeInTheDocument();
      });
    });

    it('displays services section with "Your Services" header', async () => {
      render(<SetupServices />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Your Services')).toBeInTheDocument();
      });
    });

    it('shows "Add Another Service" button', async () => {
      render(<SetupServices />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Add Another Service/i })).toBeInTheDocument();
      });
    });

    it('shows service form fields (name, price, duration)', async () => {
      render(<SetupServices />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/e.g., Dental Checkup/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText('99')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('60')).toBeInTheDocument();
      });
    });

    it('hides custom instructions for Growth plan (hasCustomAiTraining=false)', async () => {
      render(<SetupServices />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.queryByLabelText(/Custom Instructions/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Pro Plan UI (hasCustomAgent=true, hasCustomAiTraining=true)', () => {
    beforeEach(() => {
      // Pro plan: has both custom agent and custom AI training
      mockCurrentTierData = {
        subscription: { plan: 'pro', status: 'active' },
        currentPlanId: 'pro',
        currentTier: mockSubscriptionTiers[2],
        isLoading: false,
        features: {
          hasCustomAgent: true,
          hasOutboundReminders: true,
          hasCallRecordings: true,
          hasApiAccess: false,
          hasPrioritySupport: true,
          hasCustomAiTraining: true,
          hasSlaGuarantee: false,
          hasHipaaCompliance: false,
          hasVoiceSelection: false,
          hasMultiLanguage: false,
          credits: 1400,
        },
      };
    });

    it('displays custom instructions textarea for Pro plan', async () => {
      render(<SetupServices />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByLabelText(/Custom Instructions/i)).toBeInTheDocument();
      });
    });

    it('shows all customization options for Pro plan', async () => {
      render(<SetupServices />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByLabelText(/Custom Greeting/i)).toBeInTheDocument();
        expect(screen.getByText('Your Services')).toBeInTheDocument();
        expect(screen.getByLabelText(/Custom Instructions/i)).toBeInTheDocument();
      });
    });
  });

  describe('Core Plan UI (hasCustomAgent=false)', () => {
    beforeEach(() => {
      // Core plan: no custom agent capability
      mockCurrentTierData = {
        subscription: { plan: 'core', status: 'trial' },
        currentPlanId: 'core',
        currentTier: mockSubscriptionTiers[0],
        isLoading: false,
        features: {
          hasCustomAgent: false,
          hasOutboundReminders: false,
          hasCallRecordings: true,
          hasApiAccess: false,
          hasPrioritySupport: false,
          hasCustomAiTraining: false,
          hasSlaGuarantee: false,
          hasHipaaCompliance: false,
          hasVoiceSelection: false,
          hasMultiLanguage: false,
          credits: 250,
        },
      };
    });

    it('shows "Setting Up Your Agent" message for Core plan', async () => {
      render(<SetupServices />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Setting Up Your Agent')).toBeInTheDocument();
      });
    });

    it('shows upgrade link for Core plan', async () => {
      render(<SetupServices />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText(/Upgrade your plan/i)).toBeInTheDocument();
      });
    });
  });
});
