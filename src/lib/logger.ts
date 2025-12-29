/**
 * Structured logging utility with environment-aware log levels
 *
 * Log Levels (most to least verbose):
 * - TRACE: Very detailed debugging (local only)
 * - DEBUG: Debugging information (local + devo)
 * - INFO: General information (rarely in prod)
 * - WARN: Warnings (all environments)
 * - ERROR: Errors (all environments)
 *
 * Environment defaults:
 * - Local (localhost): TRACE (everything)
 * - Devo (unpublished lovable): DEBUG
 * - Prod (published lovable): WARN (minimal)
 */

export enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
  NONE = 5,
}

export type Environment = 'local' | 'devo' | 'prod';

/**
 * Detect current environment
 */
export function getEnvironment(): Environment {
  // Explicit override via env var
  const explicitEnv = import.meta.env.VITE_ENVIRONMENT as string | undefined;
  if (explicitEnv === 'local' || explicitEnv === 'devo' || explicitEnv === 'prod') {
    return explicitEnv;
  }

  // Local: Supabase URL points to localhost
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (supabaseUrl?.includes('localhost') || supabaseUrl?.includes('127.0.0.1')) {
    return 'local';
  }

  // Devo: Development mode (Vite dev server)
  if (import.meta.env.DEV) {
    return 'devo';
  }

  // Prod: Production build
  // Additional check: Lovable preview URLs contain specific patterns
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    // Lovable preview/staging URLs - adjust pattern as needed
    if (hostname.includes('preview') || hostname.includes('staging')) {
      return 'devo';
    }
  }

  return 'prod';
}

/**
 * Get log level for current environment
 */
function getLogLevel(): LogLevel {
  // Explicit override via env var
  const explicitLevel = import.meta.env.VITE_LOG_LEVEL as string | undefined;
  if (explicitLevel) {
    const level = LogLevel[explicitLevel.toUpperCase() as keyof typeof LogLevel];
    if (level !== undefined) return level;
  }

  // Environment defaults
  const env = getEnvironment();
  switch (env) {
    case 'local':
      return LogLevel.TRACE;
    case 'devo':
      return LogLevel.DEBUG;
    case 'prod':
      return LogLevel.WARN;
    default:
      return LogLevel.WARN;
  }
}

// Cache the log level (computed once at startup)
const currentLogLevel = getLogLevel();
const currentEnvironment = getEnvironment();

/**
 * Create a logger for a specific module/context
 */
export function createLogger(context: string) {
  const prefix = `[${context}]`;

  const shouldLog = (level: LogLevel): boolean => {
    return level >= currentLogLevel;
  };

  return {
    /**
     * TRACE: Very detailed debugging info (local only)
     * Use for: step-by-step execution, variable dumps, loop iterations
     */
    trace: (...args: unknown[]) => {
      if (shouldLog(LogLevel.TRACE)) {
        console.debug(prefix, ...args);
      }
    },

    /**
     * DEBUG: Debugging information (local + devo)
     * Use for: function entry/exit, state changes, API calls
     */
    debug: (...args: unknown[]) => {
      if (shouldLog(LogLevel.DEBUG)) {
        console.debug(prefix, ...args);
      }
    },

    /**
     * INFO: General information
     * Use for: important state changes, user actions, startup/shutdown
     */
    info: (...args: unknown[]) => {
      if (shouldLog(LogLevel.INFO)) {
        console.info(prefix, ...args);
      }
    },

    /**
     * WARN: Warnings (all environments)
     * Use for: recoverable errors, deprecations, unexpected but handled cases
     */
    warn: (...args: unknown[]) => {
      if (shouldLog(LogLevel.WARN)) {
        console.warn(prefix, ...args);
      }
    },

    /**
     * ERROR: Errors (all environments)
     * Use for: unrecoverable errors, exceptions, critical failures
     */
    error: (...args: unknown[]) => {
      if (shouldLog(LogLevel.ERROR)) {
        console.error(prefix, ...args);
      }
    },

    /** Current log level */
    level: currentLogLevel,

    /** Current environment */
    environment: currentEnvironment,
  };
}

// Default logger for quick usage
export const logger = createLogger('App');
