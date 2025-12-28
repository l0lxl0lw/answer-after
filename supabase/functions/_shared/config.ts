/**
 * Centralized configuration for Edge Functions
 * Provides environment-specific settings and utilities
 */

export type Environment = 'local' | 'development' | 'staging' | 'production';

interface Config {
  environment: Environment;
  isLocal: boolean;
  isDevelopment: boolean;
  isProduction: boolean;

  supabase: {
    url: string;
    anonKey: string;
    serviceRoleKey: string;
  };

  // Helper to append environment suffix to names
  appendEnvironmentSuffix: (name: string) => string;

  // Helper to check if we should use test/sandbox modes
  useSandboxMode: boolean;
}

function detectEnvironment(): Environment {
  // Check explicit environment variable first
  const envVar = Deno.env.get('ENVIRONMENT');
  if (envVar === 'production') return 'production';
  if (envVar === 'staging') return 'staging';
  if (envVar === 'development') return 'development';

  // Detect based on Supabase URL
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';

  // Local development indicators
  if (
    supabaseUrl.includes('localhost') ||
    supabaseUrl.includes('127.0.0.1') ||
    supabaseUrl.includes('kong:8000') || // Docker internal network
    supabaseUrl.includes('local')
  ) {
    return 'local';
  }

  // Production URL patterns
  if (supabaseUrl.includes('.supabase.co')) {
    return 'production';
  }

  // Default to development for safety
  return 'development';
}

// Initialize configuration
const environment = detectEnvironment();

export const config: Config = {
  environment,
  isLocal: environment === 'local',
  isDevelopment: environment === 'development',
  isProduction: environment === 'production',

  supabase: {
    url: Deno.env.get('SUPABASE_URL') || '',
    anonKey: Deno.env.get('SUPABASE_ANON_KEY') || '',
    serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
  },

  appendEnvironmentSuffix: (name: string): string => {
    if (environment === 'local') {
      return `${name} (local)`;
    }
    if (environment === 'development') {
      return `${name} (dev)`;
    }
    if (environment === 'staging') {
      return `${name} (staging)`;
    }
    return name; // production - no suffix
  },

  useSandboxMode: environment === 'local' || environment === 'development',
};

// Log configuration on module load (for debugging)
if (config.isLocal) {
  console.log(`[Config] Environment: ${environment}`);
  console.log(`[Config] Supabase URL: ${config.supabase.url}`);
  console.log(`[Config] Sandbox mode: ${config.useSandboxMode}`);
}
