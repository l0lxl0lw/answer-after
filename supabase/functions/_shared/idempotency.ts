/**
 * Idempotency utilities for preventing duplicate operations
 * Ensures webhooks and other operations can be safely retried
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createServiceClient } from './db.ts';
import { Logger } from './logger.ts';

export interface IdempotencyCheck {
  isProcessed: boolean;
  result?: any;
}

/**
 * Check if an operation has already been processed
 * Uses a simple table-based approach for idempotency
 */
export async function checkIdempotency(
  key: string,
  logger?: Logger
): Promise<IdempotencyCheck> {
  const client = createServiceClient();

  try {
    const { data, error } = await client
      .from('idempotency_keys')
      .select('*')
      .eq('key', key)
      .maybeSingle();

    if (error) {
      logger?.warn('Idempotency check failed', { error: error.message });
      // If we can't check, assume not processed (fail open)
      return { isProcessed: false };
    }

    if (data) {
      logger?.info('Operation already processed', { key, timestamp: data.created_at });
      return {
        isProcessed: true,
        result: data.result,
      };
    }

    return { isProcessed: false };
  } catch (error) {
    logger?.error('Idempotency check exception', error as Error);
    return { isProcessed: false };
  }
}

/**
 * Mark an operation as processed
 */
export async function markProcessed(
  key: string,
  result: any,
  logger?: Logger
): Promise<void> {
  const client = createServiceClient();

  try {
    const { error } = await client
      .from('idempotency_keys')
      .insert({
        key,
        result: JSON.stringify(result),
        processed_at: new Date().toISOString(),
      });

    if (error) {
      logger?.error('Failed to mark operation as processed', error);
      // Non-fatal - log and continue
    } else {
      logger?.debug('Operation marked as processed', { key });
    }
  } catch (error) {
    logger?.error('Exception marking operation as processed', error as Error);
    // Non-fatal - log and continue
  }
}

/**
 * Execute an operation with idempotency protection
 */
export async function withIdempotency<T>(
  key: string,
  operation: () => Promise<T>,
  logger?: Logger
): Promise<T> {
  // Check if already processed
  const check = await checkIdempotency(key, logger);

  if (check.isProcessed) {
    logger?.info('Returning cached result from idempotency check');
    return check.result as T;
  }

  // Execute operation
  logger?.debug('Executing idempotent operation', { key });
  const result = await operation();

  // Mark as processed
  await markProcessed(key, result, logger);

  return result;
}

/**
 * Generate idempotency key for webhook events
 */
export function generateWebhookKey(eventType: string, eventId: string): string {
  return `webhook:${eventType}:${eventId}`;
}

/**
 * Generate idempotency key for onboarding
 */
export function generateOnboardingKey(institutionId: string): string {
  return `onboarding:${institutionId}`;
}
