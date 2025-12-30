/**
 * Twilio utility functions
 * Provides common Twilio operations and helpers
 */

import { EdgeFunctionError } from './types.ts';
import { config } from './config.ts';

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
}

export interface TwilioSubaccount {
  sid: string;
  authToken: string;
  friendlyName?: string;
}

export interface TwilioPhoneNumber {
  sid: string;
  phone_number: string;
  friendly_name?: string;
}

/**
 * Get Twilio credentials from environment
 */
export function getTwilioCredentials(): TwilioConfig {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');

  if (!accountSid || !authToken) {
    throw new EdgeFunctionError(
      'Twilio credentials not configured',
      'CONFIG_ERROR',
      500
    );
  }

  return { accountSid, authToken };
}

/**
 * Check if local subaccount mode is enabled
 */
export function isLocalSubaccountMode(): boolean {
  return Deno.env.get('USE_LOCAL_SUBACCOUNT') === 'true';
}

/**
 * Check if dev mode (mock Twilio) is enabled
 */
export function isDevMode(): boolean {
  return Deno.env.get('DEV_MODE') === 'true';
}

/**
 * Get local subaccount credentials if configured
 */
export function getLocalSubaccountConfig(): { sid?: string; authToken?: string } {
  return {
    sid: Deno.env.get('LOCAL_SUBACCOUNT_SID'),
    authToken: Deno.env.get('LOCAL_SUBACCOUNT_AUTH_TOKEN'),
  };
}

/**
 * Create Basic auth header for Twilio API
 */
export function getTwilioAuthHeader(accountSid: string, authToken: string): string {
  return `Basic ${btoa(`${accountSid}:${authToken}`)}`;
}

/**
 * Make an authenticated request to Twilio API
 */
export async function makeTwilioRequest<T = any>(
  url: string,
  options: {
    accountSid: string;
    authToken: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: URLSearchParams | Record<string, string>;
  }
): Promise<T> {
  const { accountSid, authToken, method = 'GET', body } = options;

  const headers: HeadersInit = {
    'Authorization': getTwilioAuthHeader(accountSid, authToken),
  };

  if (body) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body instanceof URLSearchParams ? body : body ? new URLSearchParams(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `Twilio API error (${response.status})`;

    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.message || errorJson.error_message || errorMessage;
    } catch {
      errorMessage = errorText || errorMessage;
    }

    throw new EdgeFunctionError(
      errorMessage,
      'TWILIO_API_ERROR',
      response.status,
      { url, status: response.status }
    );
  }

  return response.json();
}

/**
 * Base URL for Twilio API
 */
export const TWILIO_API_BASE = 'https://api.twilio.com/2010-04-01';

/**
 * Get account URL for Twilio API
 */
export function getAccountUrl(accountSid: string): string {
  return `${TWILIO_API_BASE}/Accounts/${accountSid}`;
}

/**
 * Create a Twilio subaccount
 */
export async function createSubaccount(
  friendlyName: string,
  credentials: TwilioConfig
): Promise<TwilioSubaccount> {
  const url = `${TWILIO_API_BASE}/Accounts.json`;

  const result = await makeTwilioRequest<{
    sid: string;
    auth_token: string;
    friendly_name: string;
  }>(url, {
    ...credentials,
    method: 'POST',
    body: { FriendlyName: friendlyName },
  });

  return {
    sid: result.sid,
    authToken: result.auth_token,
    friendlyName: result.friendly_name,
  };
}

/**
 * Get subaccount details
 */
export async function getSubaccount(
  subaccountSid: string,
  credentials: TwilioConfig
): Promise<TwilioSubaccount> {
  const url = `${TWILIO_API_BASE}/Accounts/${subaccountSid}.json`;

  const result = await makeTwilioRequest<{
    sid: string;
    auth_token: string;
    friendly_name: string;
  }>(url, credentials);

  return {
    sid: result.sid,
    authToken: result.auth_token,
    friendlyName: result.friendly_name,
  };
}

/**
 * List subaccounts, optionally filtering by name
 */
export async function listSubaccounts(
  credentials: TwilioConfig,
  nameFilter?: string
): Promise<TwilioSubaccount[]> {
  const url = `${TWILIO_API_BASE}/Accounts.json`;

  const result = await makeTwilioRequest<{
    accounts: Array<{
      sid: string;
      auth_token: string;
      friendly_name: string;
    }>;
  }>(url, credentials);

  let accounts = result.accounts || [];

  if (nameFilter) {
    accounts = accounts.filter(acc =>
      acc.friendly_name?.toLowerCase().includes(nameFilter.toLowerCase())
    );
  }

  return accounts.map(acc => ({
    sid: acc.sid,
    authToken: acc.auth_token,
    friendlyName: acc.friendly_name,
  }));
}

/**
 * Search for available phone numbers
 */
export async function searchAvailableNumbers(
  subaccount: TwilioSubaccount,
  areaCode: string,
  limit: number = 1
): Promise<Array<{ phoneNumber: string; friendlyName: string }>> {
  const url = `${getAccountUrl(subaccount.sid)}/AvailablePhoneNumbers/US/Local.json?AreaCode=${areaCode}&Limit=${limit}`;

  const result = await makeTwilioRequest<{
    available_phone_numbers: Array<{
      phone_number: string;
      friendly_name: string;
    }>;
  }>(url, {
    accountSid: subaccount.sid,
    authToken: subaccount.authToken,
  });

  return (result.available_phone_numbers || []).map(num => ({
    phoneNumber: num.phone_number,
    friendlyName: num.friendly_name,
  }));
}

/**
 * Purchase a phone number
 */
export async function purchasePhoneNumber(
  subaccount: TwilioSubaccount,
  phoneNumber: string,
  webhookUrl?: string
): Promise<TwilioPhoneNumber> {
  const url = `${getAccountUrl(subaccount.sid)}/IncomingPhoneNumbers.json`;

  const body: Record<string, string> = {
    PhoneNumber: phoneNumber,
  };

  if (webhookUrl) {
    body.VoiceUrl = webhookUrl;
    body.VoiceMethod = 'POST';
  }

  const result = await makeTwilioRequest<{
    sid: string;
    phone_number: string;
    friendly_name: string;
  }>(url, {
    accountSid: subaccount.sid,
    authToken: subaccount.authToken,
    method: 'POST',
    body,
  });

  return {
    sid: result.sid,
    phone_number: result.phone_number,
    friendly_name: result.friendly_name,
  };
}

/**
 * List phone numbers for an account
 */
export async function listPhoneNumbers(
  subaccount: TwilioSubaccount
): Promise<TwilioPhoneNumber[]> {
  const url = `${getAccountUrl(subaccount.sid)}/IncomingPhoneNumbers.json`;

  const result = await makeTwilioRequest<{
    incoming_phone_numbers: Array<{
      sid: string;
      phone_number: string;
      friendly_name: string;
    }>;
  }>(url, {
    accountSid: subaccount.sid,
    authToken: subaccount.authToken,
  });

  return (result.incoming_phone_numbers || []).map(num => ({
    sid: num.sid,
    phone_number: num.phone_number,
    friendly_name: num.friendly_name,
  }));
}

/**
 * Update phone number webhook
 */
export async function updatePhoneNumberWebhook(
  subaccount: TwilioSubaccount,
  phoneNumberSid: string,
  webhookUrl: string
): Promise<void> {
  const url = `${getAccountUrl(subaccount.sid)}/IncomingPhoneNumbers/${phoneNumberSid}.json`;

  await makeTwilioRequest(url, {
    accountSid: subaccount.sid,
    authToken: subaccount.authToken,
    method: 'POST',
    body: {
      VoiceUrl: webhookUrl,
      VoiceMethod: 'POST',
    },
  });
}

/**
 * Release (delete) a phone number
 */
export async function releasePhoneNumber(
  subaccount: TwilioSubaccount,
  phoneNumberSid: string
): Promise<void> {
  const url = `${getAccountUrl(subaccount.sid)}/IncomingPhoneNumbers/${phoneNumberSid}.json`;

  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': getTwilioAuthHeader(subaccount.sid, subaccount.authToken),
    },
  });

  if (!response.ok && response.status !== 404) {
    throw new EdgeFunctionError(
      'Failed to release phone number',
      'TWILIO_API_ERROR',
      response.status,
      { phoneNumberSid }
    );
  }
}

/**
 * Generate mock phone number for dev mode
 */
export function generateMockPhoneNumber(areaCode: string): TwilioPhoneNumber {
  const randomSuffix = String(Math.floor(Math.random() * 1000)).padStart(3, '0');

  return {
    sid: `PN${Date.now()}mock`,
    phone_number: `+1${areaCode}5551${randomSuffix}`,
    friendly_name: `Mock Number (${areaCode})`,
  };
}
