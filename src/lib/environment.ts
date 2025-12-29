/**
 * Environment detection utilities
 * Provides consistent environment checks across the application
 */

/**
 * Check if running in local development environment
 * Detects localhost or 127.0.0.1 in Supabase URL
 */
export const isLocalEnvironment = (): boolean => {
  const url = import.meta.env.VITE_SUPABASE_URL;
  return url?.includes('localhost') || url?.includes('127.0.0.1') || false;
};

/**
 * Check if running in development mode
 * Uses Vite's MODE and PROD flags
 */
export const isDevelopmentMode = (): boolean => {
  return import.meta.env.MODE === 'development' || !import.meta.env.PROD;
};

/**
 * Determine if Stripe integration should be skipped
 * Returns true in local or development environments
 */
export const shouldSkipStripe = (): boolean => {
  return isLocalEnvironment() || isDevelopmentMode();
};
