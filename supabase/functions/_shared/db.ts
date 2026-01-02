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
  institutionId: string
) {
  const { data, error } = await client
    .from('institutions')
    .select('*')
    .eq('id', institutionId)
    .maybeSingle();

  if (error) {
    throw new EdgeFunctionError(
      `Failed to fetch organization: ${error.message}`,
      'DATABASE_ERROR',
      500,
      { institutionId, error: error.message }
    );
  }

  if (!data) {
    throw new EdgeFunctionError(
      'Organization not found',
      'NOT_FOUND',
      404,
      { institutionId }
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

// ============= Query Helpers =============

/**
 * Alias for getOrganization - get institution by ID
 */
export const getInstitution = getOrganization;

/**
 * Get user profile by user ID
 */
export async function getProfile(
  client: SupabaseClient,
  userId: string
) {
  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw new EdgeFunctionError(
      `Failed to fetch profile: ${error.message}`,
      'DATABASE_ERROR',
      500,
      { userId, error: error.message }
    );
  }

  return data;
}

/**
 * Get subscription for an institution
 */
export async function getSubscription(
  client: SupabaseClient,
  institutionId: string
) {
  const { data, error } = await client
    .from('subscriptions')
    .select('*')
    .eq('institution_id', institutionId)
    .maybeSingle();

  if (error) {
    throw new EdgeFunctionError(
      `Failed to fetch subscription: ${error.message}`,
      'DATABASE_ERROR',
      500,
      { institutionId, error: error.message }
    );
  }

  return data;
}

/**
 * Get phone numbers for an institution
 */
export async function getPhoneNumbers(
  client: SupabaseClient,
  institutionId: string
) {
  const { data, error } = await client
    .from('phone_numbers')
    .select('*')
    .eq('institution_id', institutionId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new EdgeFunctionError(
      `Failed to fetch phone numbers: ${error.message}`,
      'DATABASE_ERROR',
      500,
      { institutionId, error: error.message }
    );
  }

  return data || [];
}

/**
 * Get institution agent configuration
 */
export async function getInstitutionAgent(
  client: SupabaseClient,
  institutionId: string
) {
  const { data, error } = await client
    .from('institution_agents')
    .select('*')
    .eq('institution_id', institutionId)
    .maybeSingle();

  if (error) {
    throw new EdgeFunctionError(
      `Failed to fetch institution agent: ${error.message}`,
      'DATABASE_ERROR',
      500,
      { institutionId, error: error.message }
    );
  }

  return data;
}
