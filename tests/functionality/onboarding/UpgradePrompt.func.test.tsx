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

// Mock for useCurrentSubscriptionTier hook - tests DB-driven feature gating
let mockCurrentTierData = {
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
    hasCustomAiTraining: false,  // DB flag: determines if upgrade prompt is skipped
    hasSlaGuarantee: false,
    hasHipaaCompliance: false,
    phoneLines: 1,
    credits: 250,
  },
};

// Mock for useSubscriptionTiers
let mockTiersData = {
  data: mockSubscriptionTiers,
  isLoading: false,
  error: null,
};

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
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

// Mock use-api hooks - now uses DB feature flags
vi.mock('@/hooks/use-api', () => ({
  useSubscriptionTiers: () => mockTiersData,
  useCurrentSubscriptionTier: () => mockCurrentTierData,
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
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
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
import UpgradePrompt from '@/pages/onboarding/UpgradePrompt';

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

describe('UpgradePrompt Functionality', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();

    // Default: return subscription tiers
    mockTiersData = {
      data: mockSubscriptionTiers,
      isLoading: false,
      error: null,
    };

    // Default: core subscription (hasCustomAiTraining=false, shows upgrade prompt)
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
        phoneLines: 1,
        credits: 250,
      },
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Plan Hierarchy', () => {
    it('Core plan shows Growth as upgrade target', async () => {
      render(<UpgradePrompt />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Growth')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Upgrade to Growth/i })).toBeInTheDocument();
      });
    });

    it('Growth plan shows Pro as upgrade target', async () => {
      // Growth plan: hasCustomAiTraining=false, shows upgrade prompt
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
          phoneLines: 1,
          credits: 600,
        },
      };

      render(<UpgradePrompt />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Pro')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Upgrade to Pro/i })).toBeInTheDocument();
      });
    });

    it('Pro plan auto-redirects to /onboarding/setup-services (hasCustomAiTraining=true)', async () => {
      // Pro plan: hasCustomAiTraining=true (DB flag), skips upgrade prompt
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
          hasCustomAiTraining: true, // This DB flag triggers the skip
          hasSlaGuarantee: false,
          hasHipaaCompliance: false,
          phoneLines: 1,
          credits: 1400,
        },
      };

      render(<UpgradePrompt />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/onboarding/setup-services', { replace: true });
      });
    });

    it('Business plan auto-redirects to /onboarding/setup-services (hasCustomAiTraining=true)', async () => {
      // Business plan: hasCustomAiTraining=true (DB flag), skips upgrade prompt
      mockCurrentTierData = {
        subscription: { plan: 'business', status: 'active' },
        currentPlanId: 'business',
        currentTier: mockSubscriptionTiers[3],
        isLoading: false,
        features: {
          hasCustomAgent: true,
          hasOutboundReminders: true,
          hasCallRecordings: true,
          hasApiAccess: true,
          hasPrioritySupport: true,
          hasCustomAiTraining: true, // This DB flag triggers the skip
          hasSlaGuarantee: false,
          hasHipaaCompliance: false,
          phoneLines: 2,
          credits: 3000,
        },
      };

      render(<UpgradePrompt />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/onboarding/setup-services', { replace: true });
      });
    });
  });

  describe('Navigation', () => {
    it('Skip button navigates to /onboarding/setup-services', async () => {
      render(<UpgradePrompt />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Continue with Core/i })).toBeInTheDocument();
      });

      const skipButton = screen.getByRole('button', { name: /Continue with Core/i });
      await user.click(skipButton);

      expect(mockNavigate).toHaveBeenCalledWith('/onboarding/setup-services');
    });

    it('Upgrade button navigates to /dashboard/subscriptions', async () => {
      render(<UpgradePrompt />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Upgrade to Growth/i })).toBeInTheDocument();
      });

      const upgradeButton = screen.getByRole('button', { name: /Upgrade to Growth/i });
      await user.click(upgradeButton);

      expect(mockNavigate).toHaveBeenCalledWith('/dashboard/subscriptions');
    });
  });

  describe('Error Handling', () => {
    it('redirects to /onboarding/select-plan when no subscription exists', async () => {
      mockCurrentTierData = {
        ...mockCurrentTierData,
        subscription: null,
      };

      render(<UpgradePrompt />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/onboarding/select-plan', { replace: true });
      });
    });

    it('defaults to Core when plan field is missing', async () => {
      // currentPlanId defaults to 'core' when subscription.plan is missing
      mockCurrentTierData = {
        subscription: { status: 'trial' }, // No plan field
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
          phoneLines: 1,
          credits: 250,
        },
      };

      render(<UpgradePrompt />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Core')).toBeInTheDocument();
      });
    });
  });
});
