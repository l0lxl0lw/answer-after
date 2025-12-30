/**
 * Environment detection utilities
 * Provides consistent environment checks across the application
 */

import { getEnvironment, type Environment } from './logger';

// Re-export for convenience
export { getEnvironment, type Environment };

/**
 * Check if running in local development environment
 * Detects localhost or 127.0.0.1 in Supabase URL
 */
export const isLocalEnvironment = (): boolean => {
  return getEnvironment() === 'local';
};

/**
 * Check if running in development mode (local or devo)
 */
export const isDevelopmentMode = (): boolean => {
  const env = getEnvironment();
  return env === 'local' || env === 'devo';
};

/**
 * Check if running in production
 */
export const isProductionEnvironment = (): boolean => {
  return getEnvironment() === 'prod';
};

/**
 * Determine if Stripe integration should be skipped
 * Returns true ONLY for truly local development (localhost Supabase)
 * Lovable preview and production should always use Stripe
 */
export const shouldSkipStripe = (): boolean => {
  const env = getEnvironment();
  // Only skip for local environment (localhost Supabase)
  // Devo (Lovable preview) and prod should use Stripe
  return env === 'local';
};
