import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

interface Profile {
  id: string;
  email: string;
  full_name: string;
  organization_id: string | null;
  phone: string | null;
  avatar_url: string | null;
}

interface Organization {
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
  organization_id: string | null;
  organization: Organization | null;
}

interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  signup: (email: string, password: string, name: string, orgName: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserData = useCallback(async (userId: string): Promise<AuthUser | null> => {
    try {
      console.log('[AuthContext] Fetching user data for:', userId);

      // Fetch profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) {
        console.error('[AuthContext] Error fetching profile:', profileError);
        return null;
      }

      if (!profile) {
        console.error('[AuthContext] No profile found for user:', userId);
        return null;
      }

      console.log('[AuthContext] Profile fetched:', profile);

      // Fetch role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (roleError) {
        console.warn('[AuthContext] Error fetching role:', roleError);
      }

      const role: UserRole = (roleData?.role as UserRole) || 'staff';
      console.log('[AuthContext] User role:', role);

      // Fetch organization if exists
      let organization: Organization | null = null;
      if (profile.organization_id) {
        const { data: orgData } = await supabase
          .from('organizations')
          .select('*')
          .eq('id', profile.organization_id)
          .maybeSingle();

        organization = orgData;
        console.log('[AuthContext] Organization:', organization);
      } else {
        console.log('[AuthContext] No organization_id in profile');
      }

      const userData = {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        role,
        organization_id: profile.organization_id,
        organization,
      };

      console.log('[AuthContext] User data assembled:', userData);
      return userData;
    } catch (error) {
      console.error('[AuthContext] Error in fetchUserData:', error);
      return null;
    }
  }, []);

  // Set up auth state listener
  useEffect(() => {
    console.log('[AuthContext] Setting up auth state listener');

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        console.log('[AuthContext] Auth state changed:', event, 'Session:', !!newSession);
        setSession(newSession);

        if (newSession?.user) {
          console.log('[AuthContext] New session user detected, fetching user data');
          // Defer profile fetch to avoid deadlock
          setTimeout(() => {
            fetchUserData(newSession.user.id).then((userData) => {
              console.log('[AuthContext] User data set from auth change:', userData);
              setUser(userData);
            });
          }, 0);
        } else {
          console.log('[AuthContext] No session user, clearing user data');
          setUser(null);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      console.log('[AuthContext] Initial session check:', !!existingSession);
      setSession(existingSession);
      if (existingSession?.user) {
        fetchUserData(existingSession.user.id).then((userData) => {
          console.log('[AuthContext] Initial user data loaded:', userData);
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
      console.log('[AuthContext] Login attempt for:', email);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('[AuthContext] Login error:', error);
        if (error.message.includes('Invalid login credentials')) {
          return { error: 'Invalid email or password. Please try again.' };
        }
        return { error: error.message };
      }

      console.log('[AuthContext] Login successful, session created');
      return {};
    } catch (error: any) {
      console.error('[AuthContext] Login exception:', error);
      return { error: 'An unexpected error occurred. Please try again.' };
    }
  }, []);

  const signup = useCallback(async (email: string, password: string, name: string, orgName: string) => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: name,
            organization_name: orgName,
          },
        },
      });

      if (error) {
        console.error('Signup error:', error);
        if (error.message.includes('User already registered')) {
          return { error: 'An account with this email already exists. Please log in instead.' };
        }
        return { error: error.message };
      }

      return {};
    } catch (error: any) {
      console.error('Signup exception:', error);
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
    console.log('[AuthContext] Auth state:', {
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
