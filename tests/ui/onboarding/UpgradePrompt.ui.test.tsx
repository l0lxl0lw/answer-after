import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

// Mock for useCurrentSubscriptionTier hook
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
    hasCustomAiTraining: false,
    hasSlaGuarantee: false,
    hasHipaaCompliance: false,
    hasVoiceSelection: false,
    hasMultiLanguage: false,
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

describe('UpgradePrompt UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();

    // Default: return subscription tiers
    mockTiersData = {
      data: mockSubscriptionTiers,
      isLoading: false,
      error: null,
    };

    // Default: core subscription (hasCustomAiTraining=false, so shows upgrade prompt)
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

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Loading State', () => {
    it('renders loading spinner when data is loading', () => {
      mockTiersData = {
        data: undefined,
        isLoading: true,
        error: null,
      };
      mockCurrentTierData = {
        ...mockCurrentTierData,
        isLoading: true,
        currentTier: null,
      };

      render(<UpgradePrompt />, { wrapper: createWrapper() });

      expect(document.querySelector('.animate-spin')).toBeTruthy();
    });
  });

  describe('Plan Card Display', () => {
    it('displays current plan card with name and price', async () => {
      render(<UpgradePrompt />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Core')).toBeInTheDocument();
        expect(screen.getByText('$29')).toBeInTheDocument();
      });
    });

    it('displays upgrade plan card with "Recommended" badge', async () => {
      render(<UpgradePrompt />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Growth')).toBeInTheDocument();
        expect(screen.getByText('Recommended')).toBeInTheDocument();
      });
    });

    it('shows price difference text', async () => {
      render(<UpgradePrompt />, { wrapper: createWrapper() });

      await waitFor(() => {
        // Growth ($99) - Core ($29) = $70 more
        expect(screen.getByText(/\$70 more than Core/)).toBeInTheDocument();
      });
    });
  });

  describe('Button Display', () => {
    it('displays "Continue with Core" button for Core plan', async () => {
      render(<UpgradePrompt />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Continue with Core/i })).toBeInTheDocument();
      });
    });

    it('displays "Upgrade to Growth" button for Core plan', async () => {
      render(<UpgradePrompt />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Upgrade to Growth/i })).toBeInTheDocument();
      });
    });

    it('displays "Upgrade to Pro" button for Growth plan', async () => {
      // Growth plan: has custom agent but not custom AI training
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
          hasCustomAiTraining: false, // Still shows upgrade prompt
          hasSlaGuarantee: false,
          hasHipaaCompliance: false,
          hasVoiceSelection: false,
          hasMultiLanguage: false,
          credits: 600,
        },
      };

      render(<UpgradePrompt />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Upgrade to Pro/i })).toBeInTheDocument();
      });
    });
  });
});
