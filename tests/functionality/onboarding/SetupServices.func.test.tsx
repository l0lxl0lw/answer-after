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
const mockFromQuery = vi.fn();
let mockSubscriptionQuery = { data: { plan: 'growth' }, isLoading: false, error: null };

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

describe('SetupServices Functionality', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    mockFunctionsInvoke.mockClear();
    mockToast.mockClear();

    // Reset defaults
    mockSubscriptionQuery = { data: { plan: 'growth' }, isLoading: false, error: null };
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

  describe('Core Plan Feature Gating', () => {
    beforeEach(() => {
      mockSubscriptionQuery = { data: { plan: 'core' }, isLoading: false, error: null };
    });

    it('triggers automatic agent creation for Core plan', async () => {
      render(<SetupServices />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(mockFunctionsInvoke).toHaveBeenCalledWith(
          'elevenlabs-agent',
          expect.objectContaining({
            body: expect.objectContaining({
              action: 'create-agent',
            }),
          })
        );
      });
    });

    it('Core users cannot see greeting customization', async () => {
      render(<SetupServices />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.queryByLabelText(/Custom Greeting/i)).not.toBeInTheDocument();
      });
    });

    it('Core users cannot see services form', async () => {
      render(<SetupServices />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.queryByText('Your Services')).not.toBeInTheDocument();
      });
    });
  });

  describe('Growth Plan Feature Gating', () => {
    beforeEach(() => {
      mockSubscriptionQuery = { data: { plan: 'growth' }, isLoading: false, error: null };
    });

    it('Growth plan shows greeting input', async () => {
      render(<SetupServices />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByLabelText(/Custom Greeting/i)).toBeInTheDocument();
      });
    });

    it('Growth plan shows services section', async () => {
      render(<SetupServices />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Your Services')).toBeInTheDocument();
      });
    });

    it('Growth plan hides custom instructions (Pro+ only)', async () => {
      render(<SetupServices />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.queryByLabelText(/Custom Instructions/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Pro/Business Plan Feature Gating', () => {
    it('Pro plan shows all customization options', async () => {
      mockSubscriptionQuery = { data: { plan: 'pro' }, isLoading: false, error: null };

      render(<SetupServices />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByLabelText(/Custom Greeting/i)).toBeInTheDocument();
        expect(screen.getByText('Your Services')).toBeInTheDocument();
        expect(screen.getByLabelText(/Custom Instructions/i)).toBeInTheDocument();
      });
    });

    it('Business plan shows all customization options', async () => {
      mockSubscriptionQuery = { data: { plan: 'business' }, isLoading: false, error: null };

      render(<SetupServices />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByLabelText(/Custom Greeting/i)).toBeInTheDocument();
        expect(screen.getByText('Your Services')).toBeInTheDocument();
        expect(screen.getByLabelText(/Custom Instructions/i)).toBeInTheDocument();
      });
    });
  });

  describe('Services CRUD', () => {
    beforeEach(() => {
      mockSubscriptionQuery = { data: { plan: 'growth' }, isLoading: false, error: null };
    });

    it('Add Another Service creates new row', async () => {
      render(<SetupServices />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Your Services')).toBeInTheDocument();
      });

      const addButton = screen.getByRole('button', { name: /Add Another Service/i });
      await user.click(addButton);

      expect(screen.getByText('Service 2')).toBeInTheDocument();
    });

    it('updates service name on input', async () => {
      render(<SetupServices />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Your Services')).toBeInTheDocument();
      });

      const nameInput = screen.getByPlaceholderText(/e.g., Plumbing Repair/i);
      await user.type(nameInput, 'Electrical Work');

      expect(nameInput).toHaveValue('Electrical Work');
    });

    it('updates service price on input', async () => {
      render(<SetupServices />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Your Services')).toBeInTheDocument();
      });

      const priceInput = screen.getByPlaceholderText('99');
      await user.type(priceInput, '150');

      expect(priceInput).toHaveValue(150);
    });

    it('updates service duration on input', async () => {
      render(<SetupServices />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Your Services')).toBeInTheDocument();
      });

      const durationInput = screen.getByPlaceholderText('60');
      await user.type(durationInput, '90');

      expect(durationInput).toHaveValue(90);
    });
  });

  describe('Save Flow', () => {
    beforeEach(() => {
      mockSubscriptionQuery = { data: { plan: 'growth' }, isLoading: false, error: null };
    });

    it('calls elevenlabs-agent function on save', async () => {
      render(<SetupServices />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Continue/i })).toBeInTheDocument();
      });

      const continueButton = screen.getByRole('button', { name: /Continue/i });
      await user.click(continueButton);

      await waitFor(() => {
        expect(mockFunctionsInvoke).toHaveBeenCalledWith(
          'elevenlabs-agent',
          expect.anything()
        );
      });
    });

    it('navigates to /onboarding/test-call on success', async () => {
      render(<SetupServices />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Continue/i })).toBeInTheDocument();
      });

      const continueButton = screen.getByRole('button', { name: /Continue/i });
      await user.click(continueButton);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/onboarding/test-call');
      });
    });

    it('redirects to /auth when session is null', async () => {
      mockAuthValue = {
        user: null,
        session: null,
        isLoading: false,
        isAuthenticated: false,
      };

      render(<SetupServices />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Continue/i })).toBeInTheDocument();
      });

      const continueButton = screen.getByRole('button', { name: /Continue/i });
      await user.click(continueButton);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/auth');
      });
    });
  });
});
