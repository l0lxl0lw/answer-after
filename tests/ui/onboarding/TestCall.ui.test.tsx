import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import {
  createMockSession,
  createMockAuthUser,
} from '../../mocks/mock-data';

// Track navigation
const mockNavigate = vi.fn();
const mockInvalidateQueries = vi.fn();
const mockFromFn = vi.fn();
const mockChannelFn = vi.fn();
const mockRemoveChannelFn = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: any[]) => mockFromFn(...args),
    channel: (...args: any[]) => mockChannelFn(...args),
    removeChannel: (...args: any[]) => mockRemoveChannelFn(...args),
  },
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

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: mockInvalidateQueries,
    }),
  };
});

// Import after all mocks
import TestCall from '@/pages/onboarding/TestCall';

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

describe('TestCall UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    mockInvalidateQueries.mockClear();

    // Default: user has a phone number - with full chaining support
    const mockChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { phone_number: '+15551234567', is_active: true },
        error: null
      }),
      update: vi.fn().mockReturnThis(),
    };
    // Make eq return the chain for update().eq() chaining
    mockChain.update = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    mockFromFn.mockReturnValue(mockChain);

    mockChannelFn.mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnValue({ status: 'SUBSCRIBED' }),
      unsubscribe: vi.fn(),
    });

    mockAuthValue = {
      user: mockUser,
      session: mockSession,
      isLoading: false,
      isAuthenticated: true,
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Loading State', () => {
    it('shows loading when phone number not loaded', async () => {
      const emptyMockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      };
      mockFromFn.mockReturnValue(emptyMockChain);

      render(<TestCall />, { wrapper: createWrapper() });

      expect(screen.getByText(/Loading your phone number/i)).toBeInTheDocument();
    });
  });

  describe('Phone Number Display', () => {
    it('displays phone number in large format', async () => {
      render(<TestCall />, { wrapper: createWrapper() });

      await waitFor(() => {
        // The phone number should be displayed somewhere on the page
        // Check for the digits regardless of formatting
        expect(screen.getByText(/555.*123.*4567/)).toBeInTheDocument();
      });
    });

    it('phone number is clickable tel: link', async () => {
      render(<TestCall />, { wrapper: createWrapper() });

      await waitFor(() => {
        const phoneLink = screen.getByRole('link');
        expect(phoneLink).toHaveAttribute('href', 'tel:+15551234567');
      });
    });
  });

  describe('Instructions Display', () => {
    it('shows "What to expect" instructions', async () => {
      render(<TestCall />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('What to expect:')).toBeInTheDocument();
        expect(screen.getByText(/Your AI agent will greet you/)).toBeInTheDocument();
      });
    });

    it('shows pro tip about dashboard', async () => {
      render(<TestCall />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText(/Pro tip:/)).toBeInTheDocument();
        expect(screen.getByText(/view all your calls/i)).toBeInTheDocument();
      });
    });
  });

  describe('Button Display', () => {
    it('shows "I\'ve Verified It Works" button', async () => {
      render(<TestCall />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /I've Verified It Works/i })).toBeInTheDocument();
      });
    });

    it('shows "Skip for now" button', async () => {
      render(<TestCall />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Skip for now/i })).toBeInTheDocument();
      });
    });
  });

  describe('Step Indicator', () => {
    it('displays step indicator "Step 5 of 6"', async () => {
      render(<TestCall />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText(/Step 5 of 6/)).toBeInTheDocument();
      });
    });
  });
});
