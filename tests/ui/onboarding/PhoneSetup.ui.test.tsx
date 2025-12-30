import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

describe('PhoneSetup UI', () => {
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

  describe('Basic Rendering', () => {
    it('renders phone input with placeholder', () => {
      render(<PhoneSetup />, { wrapper: createWrapper() });

      expect(screen.getByPlaceholderText(/\+1 \(555\) 123-4567/i)).toBeInTheDocument();
    });

    it('displays "How it works" info section', () => {
      render(<PhoneSetup />, { wrapper: createWrapper() });

      expect(screen.getByText('How it works')).toBeInTheDocument();
    });

    it('shows step indicator "Step 2 of 6"', () => {
      render(<PhoneSetup />, { wrapper: createWrapper() });

      expect(screen.getByText(/Step 2 of 6/)).toBeInTheDocument();
    });

    it('renders business phone number label', () => {
      render(<PhoneSetup />, { wrapper: createWrapper() });

      expect(screen.getByLabelText(/Your Current Business Phone Number/i)).toBeInTheDocument();
    });
  });

  describe('Phone Validation Display', () => {
    it('displays valid checkmark for valid phone', async () => {
      render(<PhoneSetup />, { wrapper: createWrapper() });

      const input = screen.getByPlaceholderText(/\+1 \(555\) 123-4567/i);
      await user.type(input, '5551234567');

      await waitFor(() => {
        expect(screen.getByText('Valid phone number')).toBeInTheDocument();
      });
    });

    it('displays area code extraction text', async () => {
      render(<PhoneSetup />, { wrapper: createWrapper() });

      const input = screen.getByPlaceholderText(/\+1 \(555\) 123-4567/i);
      await user.type(input, '5551234567');

      await waitFor(() => {
        expect(screen.getByText(/area code 555/i)).toBeInTheDocument();
      });
    });
  });

  describe('Button States', () => {
    it('Continue button is disabled for empty input', () => {
      render(<PhoneSetup />, { wrapper: createWrapper() });

      const continueButton = screen.getByRole('button', { name: /Continue/i });
      expect(continueButton).toBeDisabled();
    });

    it('Continue button is enabled for valid phone', async () => {
      render(<PhoneSetup />, { wrapper: createWrapper() });

      const input = screen.getByPlaceholderText(/\+1 \(555\) 123-4567/i);
      await user.type(input, '5551234567');

      await waitFor(() => {
        const continueButton = screen.getByRole('button', { name: /Continue/i });
        expect(continueButton).not.toBeDisabled();
      });
    });

    it('shows loading spinner during purchase', async () => {
      mockFunctionsInvoke.mockImplementation(() => new Promise(() => {}));

      render(<PhoneSetup />, { wrapper: createWrapper() });

      const input = screen.getByPlaceholderText(/\+1 \(555\) 123-4567/i);
      await user.type(input, '5551234567');

      const continueButton = screen.getByRole('button', { name: /Continue/i });
      await user.click(continueButton);

      await waitFor(() => {
        expect(screen.getByText(/Setting up your number/i)).toBeInTheDocument();
      });
    });
  });

  describe('Existing Phone Display', () => {
    it('shows existing phone message when phone exists', () => {
      mockPhoneQuery = {
        data: { phone_number: '+15551234567' },
        isLoading: false,
        error: null,
      };

      render(<PhoneSetup />, { wrapper: createWrapper() });

      expect(screen.getByText('Phone Already Set Up')).toBeInTheDocument();
    });
  });

  describe('Success State', () => {
    it('displays success message with formatted number', async () => {
      render(<PhoneSetup />, { wrapper: createWrapper() });

      const input = screen.getByPlaceholderText(/\+1 \(555\) 123-4567/i);
      await user.type(input, '5551234567');

      const continueButton = screen.getByRole('button', { name: /Continue/i });
      await user.click(continueButton);

      await waitFor(() => {
        expect(screen.getByText('Number Activated!')).toBeInTheDocument();
      });
    });
  });
});
