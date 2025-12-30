import React, { createContext, useContext } from 'react';
import { vi } from 'vitest';
import { createMockAuthUser, createMockSession, type MockAuthUser, type MockSession } from './mock-data';

interface AuthContextType {
  user: MockAuthUser | null;
  session: MockSession | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  signup: (email: string, password: string, name: string, orgName: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
}

const MockAuthContext = createContext<AuthContextType | undefined>(undefined);

export interface MockAuthProviderProps {
  children: React.ReactNode;
  value?: Partial<AuthContextType>;
}

export function MockAuthProvider({ children, value = {} }: MockAuthProviderProps) {
  const defaultUser = createMockAuthUser();
  const defaultSession = createMockSession();

  const defaultValue: AuthContextType = {
    user: defaultUser,
    session: defaultSession,
    isLoading: false,
    isAuthenticated: true,
    login: vi.fn().mockResolvedValue({}),
    signup: vi.fn().mockResolvedValue({}),
    logout: vi.fn().mockResolvedValue(undefined),
  };

  const contextValue = { ...defaultValue, ...value };

  return (
    <MockAuthContext.Provider value={contextValue}>
      {children}
    </MockAuthContext.Provider>
  );
}

export function useMockAuth() {
  const context = useContext(MockAuthContext);
  if (context === undefined) {
    throw new Error('useMockAuth must be used within a MockAuthProvider');
  }
  return context;
}

// Create different auth scenarios for testing
export const createAuthContextValue = {
  // Authenticated user with organization
  authenticated: (overrides: Partial<AuthContextType> = {}): Partial<AuthContextType> => ({
    user: createMockAuthUser(),
    session: createMockSession(),
    isLoading: false,
    isAuthenticated: true,
    ...overrides,
  }),

  // Authenticated user without organization (new signup)
  noOrganization: (overrides: Partial<AuthContextType> = {}): Partial<AuthContextType> => ({
    user: createMockAuthUser({ organization_id: null, organization: null }),
    session: createMockSession(),
    isLoading: false,
    isAuthenticated: true,
    ...overrides,
  }),

  // Loading state
  loading: (overrides: Partial<AuthContextType> = {}): Partial<AuthContextType> => ({
    user: null,
    session: null,
    isLoading: true,
    isAuthenticated: false,
    ...overrides,
  }),

  // Unauthenticated
  unauthenticated: (overrides: Partial<AuthContextType> = {}): Partial<AuthContextType> => ({
    user: null,
    session: null,
    isLoading: false,
    isAuthenticated: false,
    ...overrides,
  }),

  // With specific plan
  withPlan: (plan: string, overrides: Partial<AuthContextType> = {}): Partial<AuthContextType> => ({
    user: createMockAuthUser(),
    session: createMockSession(),
    isLoading: false,
    isAuthenticated: true,
    ...overrides,
  }),
};
