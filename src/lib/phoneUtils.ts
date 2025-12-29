/**
 * Phone number formatting and validation utilities
 * Provides consistent phone number handling across the application
 */

/**
 * Format phone number as user types: +1 (XXX) XXX-XXXX
 * @param value - Raw phone number input
 * @returns Formatted phone number string
 */
export function formatPhoneNumber(value: string): string {
  // Strip all non-digits except leading +
  const hasPlus = value.startsWith('+');
  const digits = value.replace(/\D/g, '');

  if (digits.length === 0) return hasPlus ? '+' : '';

  // Handle US format (11 digits starting with 1, or 10 digits)
  let formatted = '';

  if (digits.length >= 1) {
    // Check if starts with country code 1
    const hasCountryCode = digits.startsWith('1') && digits.length > 10;
    const countryCode = hasCountryCode ? digits[0] : (digits.length <= 10 ? '' : digits[0]);
    const remaining = hasCountryCode ? digits.slice(1) : (digits.length <= 10 ? digits : digits.slice(1));

    if (countryCode) {
      formatted = `+${countryCode} `;
    } else if (hasPlus || digits.length > 10) {
      formatted = '+1 ';
    }

    // Format area code
    if (remaining.length > 0) {
      const areaCode = remaining.slice(0, 3);
      if (remaining.length <= 3) {
        formatted += `(${areaCode}`;
      } else {
        formatted += `(${areaCode}) `;
      }
    }

    // Format exchange
    if (remaining.length > 3) {
      const exchange = remaining.slice(3, 6);
      formatted += exchange;
    }

    // Format subscriber
    if (remaining.length > 6) {
      const subscriber = remaining.slice(6, 10);
      formatted += `-${subscriber}`;
    }
  }

  return formatted;
}

/**
 * Validate phone number format
 * @param value - Phone number to validate
 * @returns true if valid 10 or 11 digit US phone number
 */
export function isValidPhoneNumber(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length === 10 || digits.length === 11;
}

/**
 * Get just the digits for storage (E.164 format)
 * @param value - Formatted phone number
 * @returns Digits only, with +1 prefix if not present
 */
export function getPhoneDigits(value: string): string {
  const digits = value.replace(/\D/g, '');
  // Ensure it starts with country code
  if (digits.length === 10) {
    return `+1${digits}`;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  return `+${digits}`;
}

/**
 * Extract area code from phone number
 * @param phone - Phone number (formatted or unformatted)
 * @returns Area code (3 digits) or null if invalid
 */
export function extractAreaCode(phone: string): string | null {
  const cleaned = phone.replace(/\D/g, '');

  if (cleaned.length === 10) {
    return cleaned.slice(0, 3);
  } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return cleaned.slice(1, 4);
  }

  return null;
}

/**
 * Display-friendly phone number format
 * @param phone - Phone number to format
 * @returns Formatted as (XXX) XXX-XXXX or +1 (XXX) XXX-XXXX
 */
export function formatPhoneDisplay(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');

  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }

  return phone;
}
