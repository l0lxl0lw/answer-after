/**
 * Database utility functions
 * Provides common database operations and helpers
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { config } from './config.ts';
import { EdgeFunctionError } from './types.ts';

/**
 * Create a Supabase client with service role permissions
 */
export function createServiceClient(): SupabaseClient {
  if (!config.supabase.serviceRoleKey) {
    throw new EdgeFunctionError(
      'Service role key not configured',
      'CONFIG_ERROR',
      500
    );
  }

  return createClient(config.supabase.url, config.supabase.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Create an anon client (for user-facing operations)
 */
export function createAnonClient(): SupabaseClient {
  if (!config.supabase.anonKey) {
    throw new EdgeFunctionError(
      'Anon key not configured',
      'CONFIG_ERROR',
      500
    );
  }

  return createClient(config.supabase.url, config.supabase.anonKey);
}

/**
 * Create a client with user's JWT for RLS-protected queries
 */
export function createUserClient(jwt: string): SupabaseClient {
  if (!config.supabase.anonKey) {
    throw new EdgeFunctionError(
      'Anon key not configured',
      'CONFIG_ERROR',
      500
    );
  }

  return createClient(config.supabase.url, config.supabase.anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    },
  });
}

/**
 * Get user from authorization header
 */
export async function getUserFromAuth(
  authHeader: string | null
): Promise<{ user: any; error?: string }> {
  if (!authHeader) {
    return { user: null, error: 'No authorization header provided' };
  }

  const token = authHeader.replace('Bearer ', '');
  const client = createAnonClient();

  const { data, error } = await client.auth.getUser(token);

  if (error || !data.user) {
    return { user: null, error: 'Invalid or expired token' };
  }

  return { user: data.user };
}

/**
 * Check if a record exists by ID
 */
export async function recordExists(
  client: SupabaseClient,
  table: string,
  id: string
): Promise<boolean> {
  const { data, error } = await client
    .from(table)
    .select('id')
    .eq('id', id)
    .maybeSingle();

  return !!data && !error;
}

/**
 * Get organization by ID with error handling
 */
export async function getOrganization(
  client: SupabaseClient,
  organizationId: string
) {
  const { data, error } = await client
    .from('organizations')
    .select('*')
    .eq('id', organizationId)
    .maybeSingle();

  if (error) {
    throw new EdgeFunctionError(
      `Failed to fetch organization: ${error.message}`,
      'DATABASE_ERROR',
      500,
      { organizationId, error: error.message }
    );
  }

  if (!data) {
    throw new EdgeFunctionError(
      'Organization not found',
      'NOT_FOUND',
      404,
      { organizationId }
    );
  }

  return data;
}

/**
 * Retry a database operation with exponential backoff
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}
