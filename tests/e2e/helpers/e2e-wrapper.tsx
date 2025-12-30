/**
 * E2E Test Wrapper
 *
 * Provides React component wrappers for E2E tests that use real Supabase.
 * Unlike mock wrappers, this uses the actual AuthProvider and real database.
 */

import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { render, waitFor, screen } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { Toaster } from '@/components/ui/toaster';
import { supabase } from '@/lib/supabase';
import { TestClient } from '../../helpers/test-client';

// Create a QueryClient with settings optimized for testing
export const createE2EQueryClient = () =>
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

export interface E2EWrapperOptions {
  initialRoute?: string;
  routes?: Array<{ path: string; element: React.ReactNode }>;
  queryClient?: QueryClient;
}

/**
 * E2E Test Wrapper Component
 * Uses real AuthProvider with real Supabase connection
 */
export function E2EWrapper({
  children,
  options = {},
}: {
  children: React.ReactNode;
  options?: E2EWrapperOptions;
}) {
  const {
    initialRoute = '/',
    routes = [],
    queryClient = createE2EQueryClient(),
  } = options;

  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <AuthProvider>
          <Routes>
            <Route path={initialRoute} element={children} />
            {routes.map(({ path, element }) => (
              <Route key={path} path={path} element={element} />
            ))}
          </Routes>
          <Toaster />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

/**
 * Helper to render a component with E2E providers
 */
export function renderE2E(
  ui: React.ReactElement,
  options: E2EWrapperOptions = {}
) {
  const queryClient = options.queryClient || createE2EQueryClient();

  const result = render(
    <E2EWrapper options={{ ...options, queryClient }}>
      {ui}
    </E2EWrapper>
  );

  return {
    ...result,
    queryClient,
  };
}

/**
 * E2E Test Context
 * Manages test user lifecycle and provides helpers for E2E tests
 */
export class E2ETestContext {
  public testClient: TestClient;
  public testUser: {
    id: string;
    email: string;
    password: string;
    name: string;
    organizationName: string;
    phone: string;
  };

  constructor() {
    this.testClient = new TestClient();
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    this.testUser = {
      id: '',
      email: `e2e-${timestamp}${random}@example.com`,
      password: 'TestPassword123!',
      name: 'E2E Test User',
      organizationName: 'E2E Test Organization',
      phone: '+15551234567',
    };
  }

  /**
   * Sign up the test user via Supabase auth
   */
  async signUp() {
    const { data, error } = await supabase.auth.signUp({
      email: this.testUser.email,
      password: this.testUser.password,
      options: {
        data: {
          full_name: this.testUser.name,
          organization_name: this.testUser.organizationName,
        },
      },
    });

    if (error) throw new Error(`Sign up failed: ${error.message}`);
    this.testUser.id = data.user!.id;

    // Wait for profile to be created by trigger
    await this.testClient.waitForProfileCreation(this.testUser.id);

    return data;
  }

  /**
   * Sign in the test user
   */
  async signIn() {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: this.testUser.email,
      password: this.testUser.password,
    });

    if (error) throw new Error(`Sign in failed: ${error.message}`);
    return data;
  }

  /**
   * Provision organization with a specific plan
   */
  async provisionWithPlan(plan: string = 'core') {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      throw new Error('No session - must sign in first');
    }

    const result = await this.testClient.provisionOrganizationWithPlan(
      sessionData.session.access_token,
      this.testUser.organizationName,
      this.testUser.phone,
      plan
    );

    return result;
  }

  /**
   * Get subscription for test user
   */
  async getSubscription() {
    return this.testClient.getSubscriptionByEmail(this.testUser.email);
  }

  /**
   * Get subscription tier details
   */
  async getSubscriptionTier(planId: string) {
    return this.testClient.getSubscriptionTier(planId);
  }

  /**
   * Update subscription plan
   */
  async updatePlan(plan: string) {
    return this.testClient.updateSubscriptionPlan(this.testUser.email, plan);
  }

  /**
   * Clean up test data
   */
  async cleanup() {
    await supabase.auth.signOut();
    await this.testClient.cleanupTestData(this.testUser.email);
  }
}

/**
 * Wait for auth to be ready (user loaded)
 */
export async function waitForAuth(timeout = 10000) {
  await waitFor(
    () => {
      // Auth is ready when loading state completes
      const loadingIndicators = screen.queryAllByText(/loading/i);
      if (loadingIndicators.length > 0) {
        throw new Error('Still loading...');
      }
    },
    { timeout }
  );
}

/**
 * Wait for navigation to complete (check for specific text or element)
 */
export async function waitForNavigation(textOrMatcher: string | RegExp, timeout = 10000) {
  await waitFor(
    () => {
      expect(screen.getByText(textOrMatcher)).toBeInTheDocument();
    },
    { timeout }
  );
}
