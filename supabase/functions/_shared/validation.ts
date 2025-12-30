/**
 * Validation utility functions
 * Provides common validation helpers for edge functions
 */

import { EdgeFunctionError } from './types.ts';

/**
 * UUID v4 regex pattern
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Email regex pattern
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * E.164 phone number regex pattern
 */
const E164_PHONE_REGEX = /^\+[1-9]\d{1,14}$/;

/**
 * Validate a UUID v4 string
 */
export function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

/**
 * Validate a UUID and throw if invalid
 */
export function validateUUID(value: string | null | undefined, fieldName: string = 'ID'): string {
  if (!value) {
    throw new EdgeFunctionError(
      `${fieldName} is required`,
      'VALIDATION_ERROR',
      400,
      { field: fieldName }
    );
  }

  if (!isValidUUID(value)) {
    throw new EdgeFunctionError(
      `Invalid ${fieldName} format`,
      'VALIDATION_ERROR',
      400,
      { field: fieldName, value }
    );
  }

  return value;
}

/**
 * Validate an email address
 */
export function isValidEmail(value: string): boolean {
  return EMAIL_REGEX.test(value);
}

/**
 * Validate an email and throw if invalid
 */
export function validateEmail(value: string | null | undefined, fieldName: string = 'email'): string {
  if (!value) {
    throw new EdgeFunctionError(
      `${fieldName} is required`,
      'VALIDATION_ERROR',
      400,
      { field: fieldName }
    );
  }

  if (!isValidEmail(value)) {
    throw new EdgeFunctionError(
      `Invalid ${fieldName} format`,
      'VALIDATION_ERROR',
      400,
      { field: fieldName, value }
    );
  }

  return value;
}

/**
 * Validate an E.164 phone number
 */
export function isValidE164Phone(value: string): boolean {
  return E164_PHONE_REGEX.test(value);
}

/**
 * Validate a phone number and throw if invalid
 */
export function validatePhoneNumber(
  value: string | null | undefined,
  fieldName: string = 'phone number'
): string {
  if (!value) {
    throw new EdgeFunctionError(
      `${fieldName} is required`,
      'VALIDATION_ERROR',
      400,
      { field: fieldName }
    );
  }

  // Normalize: remove spaces, dashes, parentheses
  const normalized = value.replace(/[\s\-\(\)]/g, '');

  // Add + if missing and starts with 1 (US/Canada)
  const withPrefix = normalized.startsWith('+') ? normalized : `+${normalized}`;

  if (!isValidE164Phone(withPrefix)) {
    throw new EdgeFunctionError(
      `Invalid ${fieldName} format. Expected E.164 format (e.g., +12025551234)`,
      'VALIDATION_ERROR',
      400,
      { field: fieldName, value }
    );
  }

  return withPrefix;
}

/**
 * Validate a required string field
 */
export function validateRequired(
  value: string | null | undefined,
  fieldName: string
): string {
  if (!value || value.trim().length === 0) {
    throw new EdgeFunctionError(
      `${fieldName} is required`,
      'VALIDATION_ERROR',
      400,
      { field: fieldName }
    );
  }

  return value.trim();
}

/**
 * Validate string length
 */
export function validateLength(
  value: string,
  fieldName: string,
  options: { min?: number; max?: number }
): string {
  const { min, max } = options;

  if (min !== undefined && value.length < min) {
    throw new EdgeFunctionError(
      `${fieldName} must be at least ${min} characters`,
      'VALIDATION_ERROR',
      400,
      { field: fieldName, min, actual: value.length }
    );
  }

  if (max !== undefined && value.length > max) {
    throw new EdgeFunctionError(
      `${fieldName} must be at most ${max} characters`,
      'VALIDATION_ERROR',
      400,
      { field: fieldName, max, actual: value.length }
    );
  }

  return value;
}

/**
 * Validate a number is within range
 */
export function validateNumberRange(
  value: number,
  fieldName: string,
  options: { min?: number; max?: number }
): number {
  const { min, max } = options;

  if (isNaN(value)) {
    throw new EdgeFunctionError(
      `${fieldName} must be a valid number`,
      'VALIDATION_ERROR',
      400,
      { field: fieldName }
    );
  }

  if (min !== undefined && value < min) {
    throw new EdgeFunctionError(
      `${fieldName} must be at least ${min}`,
      'VALIDATION_ERROR',
      400,
      { field: fieldName, min, actual: value }
    );
  }

  if (max !== undefined && value > max) {
    throw new EdgeFunctionError(
      `${fieldName} must be at most ${max}`,
      'VALIDATION_ERROR',
      400,
      { field: fieldName, max, actual: value }
    );
  }

  return value;
}

/**
 * Validate an enum value
 */
export function validateEnum<T extends string>(
  value: string | null | undefined,
  fieldName: string,
  allowedValues: readonly T[]
): T {
  if (!value) {
    throw new EdgeFunctionError(
      `${fieldName} is required`,
      'VALIDATION_ERROR',
      400,
      { field: fieldName }
    );
  }

  if (!allowedValues.includes(value as T)) {
    throw new EdgeFunctionError(
      `Invalid ${fieldName}. Must be one of: ${allowedValues.join(', ')}`,
      'VALIDATION_ERROR',
      400,
      { field: fieldName, value, allowed: allowedValues }
    );
  }

  return value as T;
}

/**
 * Validate area code (US 3-digit format)
 */
export function validateAreaCode(value: string | null | undefined): string {
  if (!value) {
    throw new EdgeFunctionError(
      'Area code is required',
      'VALIDATION_ERROR',
      400,
      { field: 'areaCode' }
    );
  }

  const cleaned = value.replace(/\D/g, '');

  if (cleaned.length !== 3) {
    throw new EdgeFunctionError(
      'Area code must be 3 digits',
      'VALIDATION_ERROR',
      400,
      { field: 'areaCode', value }
    );
  }

  return cleaned;
}

/**
 * Sanitize a string for safe storage
 * Trims whitespace and removes control characters
 */
export function sanitizeString(value: string): string {
  // Remove control characters except newlines/tabs
  return value
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim();
}

/**
 * Parse and validate JSON body from request
 */
export async function parseJsonBody<T = Record<string, any>>(
  request: Request,
  requiredFields?: string[]
): Promise<T> {
  let body: T;

  try {
    body = await request.json();
  } catch {
    throw new EdgeFunctionError(
      'Invalid JSON in request body',
      'VALIDATION_ERROR',
      400
    );
  }

  if (requiredFields) {
    for (const field of requiredFields) {
      if (!(field in (body as any)) || (body as any)[field] === undefined) {
        throw new EdgeFunctionError(
          `Missing required field: ${field}`,
          'VALIDATION_ERROR',
          400,
          { field }
        );
      }
    }
  }

  return body;
}
