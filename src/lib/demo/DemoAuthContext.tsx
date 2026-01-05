// Demo Auth Context - Provides mock authentication for demo mode
import React, { useState, useCallback } from 'react';
import { AuthContext } from '@/contexts/AuthContext';
import { mockUser, mockAccount } from './mockData';
import type { Session } from '@supabase/supabase-js';

export function DemoAuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(true); // Start logged in for demo

  const user = isLoggedIn ? {
    id: mockUser.id,
    email: mockUser.email,
    full_name: mockUser.full_name,
    role: mockUser.role,
    account_id: mockUser.account_id,
    account: {
      id: mockAccount.id,
      name: mockAccount.name,
      slug: mockAccount.slug,
      timezone: mockAccount.timezone,
      business_hours_start: mockAccount.business_hours_start,
      business_hours_end: mockAccount.business_hours_end,
    },
  } : null;

  // Mock session object
  const session = isLoggedIn ? {
    access_token: 'demo-token',
    refresh_token: 'demo-refresh',
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id: mockUser.id,
      email: mockUser.email,
      app_metadata: {},
      user_metadata: { full_name: mockUser.full_name },
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    },
  } as unknown as Session : null;

  const login = useCallback(async (_email: string, _password: string) => {
    // Simulate login delay
    await new Promise(resolve => setTimeout(resolve, 500));
    setIsLoggedIn(true);
    return {};
  }, []);

  const signup = useCallback(async (_email: string, _password: string, _name: string, _accountName: string) => {
    // Simulate signup delay
    await new Promise(resolve => setTimeout(resolve, 500));
    setIsLoggedIn(true);
    return {};
  }, []);

  const logout = useCallback(async () => {
    setIsLoggedIn(false);
  }, []);

  // Use the same AuthContext so useAuth() works with this provider
  return (
    <AuthContext.Provider value={{
      user,
      session,
      isLoading: false,
      isAuthenticated: isLoggedIn,
      login,
      signup,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
}
