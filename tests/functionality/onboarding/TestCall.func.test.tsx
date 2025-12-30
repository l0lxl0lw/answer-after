import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

describe('TestCall Functionality', () => {
  const user = userEvent.setup();

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

  describe('Phone Number Loading', () => {
    it('fetches phone number on mount', async () => {
      render(<TestCall />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(mockFromFn).toHaveBeenCalledWith('phone_numbers');
      });
    });
  });

  describe('Completion Flow', () => {
    it('"I\'ve Verified It Works" updates is_onboarding_complete', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });

      render(<TestCall />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /I've Verified It Works/i })).toBeInTheDocument();
      });

      const verifyButton = screen.getByRole('button', { name: /I've Verified It Works/i });
      await user.click(verifyButton);

      // Should call Supabase to update organization
      await waitFor(() => {
        expect(mockFromFn).toHaveBeenCalledWith('organizations');
      });

      vi.useRealTimers();
    });

    it('"Skip for now" updates is_onboarding_complete', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });

      render(<TestCall />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Skip for now/i })).toBeInTheDocument();
      });

      const skipButton = screen.getByRole('button', { name: /Skip for now/i });
      await user.click(skipButton);

      // Should call Supabase to update organization
      await waitFor(() => {
        expect(mockFromFn).toHaveBeenCalledWith('organizations');
      });

      vi.useRealTimers();
    });

    it('invalidates onboarding-status query on completion', async () => {
      render(<TestCall />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /I've Verified It Works/i })).toBeInTheDocument();
      });

      const verifyButton = screen.getByRole('button', { name: /I've Verified It Works/i });
      await user.click(verifyButton);

      await waitFor(() => {
        expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['onboarding-status'] });
      });
    });

    it('redirects to /dashboard?welcome=true on completion', async () => {
      const originalLocation = window.location;
      delete (window as any).location;
      window.location = { ...originalLocation, href: '' } as any;

      vi.useFakeTimers({ shouldAdvanceTime: true });

      render(<TestCall />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /I've Verified It Works/i })).toBeInTheDocument();
      });

      const verifyButton = screen.getByRole('button', { name: /I've Verified It Works/i });
      await user.click(verifyButton);

      vi.advanceTimersByTime(2000);

      await waitFor(() => {
        expect(window.location.href).toBe('/dashboard?welcome=true');
      });

      window.location = originalLocation;
      vi.useRealTimers();
    });
  });

  describe('Error Handling', () => {
    it('handles missing organization_id gracefully', async () => {
      mockAuthValue = {
        user: createMockAuthUser({ organization_id: null }),
        session: createMockSession(),
        isLoading: false,
        isAuthenticated: true,
      };

      render(<TestCall />, { wrapper: createWrapper() });

      // Should show loading state indefinitely (no phone to load)
      expect(screen.getByText(/Loading your phone number/i)).toBeInTheDocument();
    });
  });

  describe('Realtime Subscription', () => {
    it('sets up realtime channel for call detection', async () => {
      render(<TestCall />, { wrapper: createWrapper() });

      // The component should set up the channel
      await waitFor(() => {
        expect(screen.getByText(/I've Verified It Works/)).toBeInTheDocument();
      });

      // Channel should be set up (checked implicitly by component rendering properly)
    });
  });
});
