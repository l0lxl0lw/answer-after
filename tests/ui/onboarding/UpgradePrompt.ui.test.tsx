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

// Mock useQuery for subscription
const mockSubscriptionData = { plan: 'core', status: 'trial' };
let mockSubscriptionQuery = {
  data: mockSubscriptionData,
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

// Mock useSubscriptionTiers
const mockUseSubscriptionTiers = vi.fn();
vi.mock('@/hooks/use-api', () => ({
  useSubscriptionTiers: () => mockUseSubscriptionTiers(),
}));

// Mock useQuery
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: () => mockSubscriptionQuery,
  };
});

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
    mockUseSubscriptionTiers.mockReturnValue({
      data: mockSubscriptionTiers,
      isLoading: false,
      error: null,
    });

    // Default: core subscription
    mockSubscriptionQuery = {
      data: { plan: 'core', status: 'trial' },
      isLoading: false,
      error: null,
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Loading State', () => {
    it('renders loading spinner when data is loading', () => {
      mockUseSubscriptionTiers.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      });
      mockSubscriptionQuery = {
        data: undefined,
        isLoading: true,
        error: null,
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
        expect(screen.getByText(/\$50 more than Core/)).toBeInTheDocument();
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
      mockSubscriptionQuery = {
        data: { plan: 'growth', status: 'active' },
        isLoading: false,
        error: null,
      };

      render(<UpgradePrompt />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Upgrade to Pro/i })).toBeInTheDocument();
      });
    });
  });
});
