/**
 * Structured logging utility for Edge Functions
 * Provides consistent, JSON-formatted logging with context
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  service?: string;
  userId?: string;
  accountId?: string;
  requestId?: string;
  [key: string]: unknown;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context: LogContext;
  data?: Record<string, unknown>;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
}

export class Logger {
  private context: LogContext;
  private minLevel: LogLevel;

  constructor(serviceName: string, context: LogContext = {}, minLevel: LogLevel = 'info') {
    this.context = {
      service: serviceName,
      ...context,
    };
    this.minLevel = minLevel;
  }

  /**
   * Add persistent context that will be included in all future logs
   */
  withContext(additionalContext: LogContext): Logger {
    return new Logger(
      this.context.service as string,
      { ...this.context, ...additionalContext },
      this.minLevel
    );
  }

  /**
   * Create a child logger for a specific operation
   */
  child(operation: string, context: LogContext = {}): Logger {
    return new Logger(
      this.context.service as string,
      {
        ...this.context,
        operation,
        ...context,
      },
      this.minLevel
    );
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.minLevel);
  }

  private formatLog(level: LogLevel, message: string, data?: Record<string, unknown>, error?: Error): string {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context: this.context,
      data,
    };

    if (error) {
      entry.error = {
        message: error.message,
        stack: error.stack,
        code: (error as any).code,
      };
    }

    return JSON.stringify(entry);
  }

  debug(message: string, data?: Record<string, unknown>): void {
    if (this.shouldLog('debug')) {
      console.log(this.formatLog('debug', message, data));
    }
  }

  info(message: string, data?: Record<string, unknown>): void {
    if (this.shouldLog('info')) {
      console.log(this.formatLog('info', message, data));
    }
  }

  warn(message: string, data?: Record<string, unknown>): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatLog('warn', message, data));
    }
  }

  error(message: string, error?: Error, data?: Record<string, unknown>): void {
    if (this.shouldLog('error')) {
      console.error(this.formatLog('error', message, data, error));
    }
  }

  /**
   * Log with custom step marker (useful for tracking multi-step operations)
   */
  step(stepName: string, data?: Record<string, unknown>): void {
    this.info(`Step: ${stepName}`, data);
  }

  /**
   * Time an operation and log the duration
   */
  async time<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    const startTime = Date.now();
    this.debug(`Starting: ${operation}`);

    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      this.info(`Completed: ${operation}`, { durationMs: duration });
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.error(`Failed: ${operation}`, error as Error, { durationMs: duration });
      throw error;
    }
  }
}

/**
 * Create a logger instance for an Edge Function
 */
export function createLogger(serviceName: string, context?: LogContext): Logger {
  // In local development, use debug level
  const minLevel: LogLevel = Deno.env.get('LOG_LEVEL') as LogLevel ||
    (Deno.env.get('SUPABASE_URL')?.includes('127.0.0.1') ? 'debug' : 'info');

  return new Logger(serviceName, context, minLevel);
}
