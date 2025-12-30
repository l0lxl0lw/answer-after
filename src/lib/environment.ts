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
 * Stripe is enabled in all environments (local uses test mode keys)
 * For local dev, run: stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook
 */
export const shouldSkipStripe = (): boolean => {
  // Stripe is enabled in all environments
  // Local uses test mode keys, prod uses live keys
  return false;
};
