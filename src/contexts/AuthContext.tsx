import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { createLogger } from '@/lib/logger';
import type { User, Session } from '@supabase/supabase-js';

const log = createLogger('AuthContext');

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  account_id: string | null;
  phone: string | null;
  avatar_url: string | null;
}

interface Account {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  business_hours_start: string | null;
  business_hours_end: string | null;
}

type UserRole = 'owner' | 'admin' | 'staff';

interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  account_id: string | null;
  account: Account | null;
}

interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  signup: (email: string, password: string, name: string, accountName: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserData = useCallback(async (userId: string): Promise<AuthUser | null> => {
    try {
      log.debug('Fetching user data for:', userId);

      // Fetch user profile
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) {
        log.error('Error fetching user profile:', profileError);
        return null;
      }

      if (!profile) {
        log.error('No user profile found for user:', userId);
        return null;
      }

      log.trace('User profile fetched:', profile);

      // Fetch role
      const { data: roleData, error: roleError } = await supabase
        .from('roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (roleError) {
        log.warn('Error fetching role:', roleError);
      }

      const role: UserRole = (roleData?.role as UserRole) || 'staff';
      log.trace('User role:', role);

      // Fetch account if exists
      let account: Account | null = null;
      if (profile.account_id) {
        const { data: accountData } = await supabase
          .from('accounts')
          .select('*')
          .eq('id', profile.account_id)
          .maybeSingle();

        account = accountData;
        log.trace('Account:', account);
      } else {
        log.trace('No account_id in user profile');
      }

      const userData = {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        role,
        account_id: profile.account_id,
        account,
      };

      log.debug('User data assembled:', userData);
      return userData;
    } catch (error) {
      log.error('Error in fetchUserData:', error);
      return null;
    }
  }, []);

  // Set up auth state listener
  useEffect(() => {
    log.debug('Setting up auth state listener');

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        log.debug('Auth state changed:', event, 'Session:', !!newSession);
        setSession(newSession);

        if (newSession?.user) {
          log.trace('New session user detected, fetching user data');
          // Defer profile fetch to avoid deadlock
          setTimeout(() => {
            fetchUserData(newSession.user.id).then((userData) => {
              log.trace('User data set from auth change:', userData);
              setUser(userData);
            });
          }, 0);
        } else {
          log.trace('No session user, clearing user data');
          setUser(null);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      log.debug('Initial session check:', !!existingSession);
      setSession(existingSession);
      if (existingSession?.user) {
        fetchUserData(existingSession.user.id).then((userData) => {
          log.trace('Initial user data loaded:', userData);
          setUser(userData);
          setIsLoading(false);
        });
      } else {
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchUserData]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      log.debug('Login attempt for:', email);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        log.error('Login error:', error);
        if (error.message.includes('Invalid login credentials')) {
          return { error: 'Invalid email or password. Please try again.' };
        }
        return { error: error.message };
      }

      log.debug('Login successful, session created');
      return {};
    } catch (error: any) {
      log.error('Login exception:', error);
      return { error: 'An unexpected error occurred. Please try again.' };
    }
  }, []);

  const signup = useCallback(async (email: string, password: string, name: string, accountName: string) => {
    try {
      const redirectUrl = `${window.location.origin}/`;

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: name,
            account_name: accountName,
          },
        },
      });

      if (error) {
        log.error('Signup error:', error);
        if (error.message.includes('User already registered')) {
          return { error: 'An account with this email already exists. Please log in instead.' };
        }
        return { error: error.message };
      }

      return {};
    } catch (error: any) {
      log.error('Signup exception:', error);
      return { error: 'An unexpected error occurred. Please try again.' };
    }
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  }, []);

  const isAuthenticated = !!user && !!session;

  // Log auth state changes
  useEffect(() => {
    log.trace('Auth state:', {
      hasUser: !!user,
      hasSession: !!session,
      isAuthenticated,
      isLoading,
      userId: user?.id,
      userEmail: user?.email,
    });
  }, [user, session, isAuthenticated, isLoading]);

  return (
    <AuthContext.Provider value={{
      user,
      session,
      isLoading,
      isAuthenticated,
      login,
      signup,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
