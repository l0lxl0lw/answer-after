import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { createMockSession, createMockAuthUser } from '../../mocks/mock-data';

// Mock navigate function
const mockNavigate = vi.fn();

// Mock Supabase functions
const mockFunctionsInvoke = vi.fn();
let mockPhoneQuery = { data: null, isLoading: false, error: null };

// Mock Supabase
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

// Mock useQuery
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: () => mockPhoneQuery,
  };
});

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

// Import after all mocks
import PhoneSetup from '@/pages/onboarding/PhoneSetup';

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

describe('PhoneSetup Functionality', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    mockFunctionsInvoke.mockClear();
    mockToast.mockClear();

    // Reset defaults
    mockPhoneQuery = { data: null, isLoading: false, error: null };
    mockAuthValue = {
      user: mockUser,
      session: mockSession,
      isLoading: false,
      isAuthenticated: true,
    };

    // Default function response
    mockFunctionsInvoke.mockResolvedValue({
      data: { success: true, phoneNumber: '+15559876543' },
      error: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Phone Purchase Flow', () => {
    it('calls purchase-phone-number edge function', async () => {
      render(<PhoneSetup />, { wrapper: createWrapper() });

      const input = screen.getByPlaceholderText(/\+1 \(555\) 123-4567/i);
      await user.type(input, '5551234567');

      const continueButton = screen.getByRole('button', { name: /Continue/i });
      await user.click(continueButton);

      await waitFor(() => {
        expect(mockFunctionsInvoke).toHaveBeenCalledWith(
          'purchase-phone-number',
          expect.objectContaining({
            body: expect.objectContaining({
              areaCode: '555',
            }),
          })
        );
      });
    });

    it('extracts correct area code from phone number', async () => {
      render(<PhoneSetup />, { wrapper: createWrapper() });

      const input = screen.getByPlaceholderText(/\+1 \(555\) 123-4567/i);
      await user.type(input, '4151234567');

      const continueButton = screen.getByRole('button', { name: /Continue/i });
      await user.click(continueButton);

      await waitFor(() => {
        expect(mockFunctionsInvoke).toHaveBeenCalledWith(
          'purchase-phone-number',
          expect.objectContaining({
            body: expect.objectContaining({
              areaCode: '415',
            }),
          })
        );
      });
    });

    it('navigates to /onboarding/setup on success', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });

      render(<PhoneSetup />, { wrapper: createWrapper() });

      const input = screen.getByPlaceholderText(/\+1 \(555\) 123-4567/i);
      await user.type(input, '5551234567');

      const continueButton = screen.getByRole('button', { name: /Continue/i });
      await user.click(continueButton);

      // The code uses setTimeout of 1500ms before navigation
      vi.advanceTimersByTime(2000);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/onboarding/setup');
      });

      vi.useRealTimers();
    });
  });

  describe('Error Handling', () => {
    it('shows error toast on purchase failure', async () => {
      mockFunctionsInvoke.mockResolvedValue({
        data: null,
        error: { message: 'Purchase failed' },
      });

      render(<PhoneSetup />, { wrapper: createWrapper() });

      const input = screen.getByPlaceholderText(/\+1 \(555\) 123-4567/i);
      await user.type(input, '5551234567');

      const continueButton = screen.getByRole('button', { name: /Continue/i });
      await user.click(continueButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: 'destructive',
          })
        );
      });
    });

    it('navigates to /auth when session is null', async () => {
      mockAuthValue = {
        user: null,
        session: null,
        isLoading: false,
        isAuthenticated: false,
      };

      render(<PhoneSetup />, { wrapper: createWrapper() });

      const input = screen.getByPlaceholderText(/\+1 \(555\) 123-4567/i);
      await user.type(input, '5551234567');

      const continueButton = screen.getByRole('button', { name: /Continue/i });
      await user.click(continueButton);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/auth');
      });
    });
  });

  describe('Enter Key Handling', () => {
    it('Enter key triggers purchase when valid', async () => {
      render(<PhoneSetup />, { wrapper: createWrapper() });

      const input = screen.getByPlaceholderText(/\+1 \(555\) 123-4567/i);
      await user.type(input, '5551234567');

      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

      await waitFor(() => {
        expect(mockFunctionsInvoke).toHaveBeenCalled();
      });
    });
  });

  describe('Existing Phone Redirect', () => {
    it('existing phone redirects to setup on continue', async () => {
      mockPhoneQuery = {
        data: { phone_number: '+15551234567' },
        isLoading: false,
        error: null,
      };

      render(<PhoneSetup />, { wrapper: createWrapper() });

      const continueButton = screen.getByRole('button', { name: /Continue/i });
      await user.click(continueButton);

      expect(mockNavigate).toHaveBeenCalledWith('/onboarding/setup');
    });
  });
});
