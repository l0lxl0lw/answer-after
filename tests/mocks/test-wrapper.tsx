import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { MockAuthProvider, type MockAuthProviderProps } from './auth-context';
import { Toaster } from '@/components/ui/toaster';

export interface TestWrapperOptions {
  route?: string;
  authValue?: MockAuthProviderProps['value'];
  queryClient?: QueryClient;
}

// Create a fresh QueryClient for each test
export const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

// Component wrapper for tests
export function TestWrapper({
  children,
  options = {},
}: {
  children: React.ReactNode;
  options?: TestWrapperOptions;
}) {
  const { route = '/', authValue = {}, queryClient = createTestQueryClient() } = options;

  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <MockAuthProvider value={authValue}>
          {children}
          <Toaster />
        </MockAuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

// Factory function for creating wrapper with options
export const createTestWrapper = (options: TestWrapperOptions = {}) => {
  const queryClient = options.queryClient || createTestQueryClient();

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <TestWrapper options={{ ...options, queryClient }}>
        {children}
      </TestWrapper>
    );
  };
};

// Wrapper with routing for components that use useNavigate
export function TestWrapperWithRoutes({
  children,
  options = {},
  routes = [],
}: {
  children: React.ReactNode;
  options?: TestWrapperOptions;
  routes?: Array<{ path: string; element: React.ReactNode }>;
}) {
  const { route = '/', authValue = {}, queryClient = createTestQueryClient() } = options;

  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <MockAuthProvider value={authValue}>
          <Routes>
            <Route path={route} element={children} />
            {routes.map(({ path, element }) => (
              <Route key={path} path={path} element={element} />
            ))}
          </Routes>
          <Toaster />
        </MockAuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

// Helper to render with default test setup
export const renderWithProviders = (
  ui: React.ReactElement,
  options: TestWrapperOptions = {}
) => {
  const queryClient = options.queryClient || createTestQueryClient();

  return {
    queryClient,
    wrapper: createTestWrapper({ ...options, queryClient }),
  };
};
