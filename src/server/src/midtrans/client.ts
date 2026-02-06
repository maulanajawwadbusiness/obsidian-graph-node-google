/**
 * Midtrans Core API Client
 * Documentation: https://docs.midtrans.com/docs/custom-interface-core-api
 *
 * Environment Variables Required:
 * - MIDTRANS_SERVER_KEY: Server key for Basic Auth
 *
 * Usage:
 *   import { midtransRequest } from './midtrans/client';
 *   const response = await midtransRequest('/v2/charge', {
 *     method: 'POST',
 *     body: { payment_type: 'bank_transfer' }
 *   });
 */

// ============================================================================
// TYPES
// ============================================================================

export interface MidtransRequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
}

export interface MidtransChargeResponse {
  status_code: string;
  status_message: string;
  transaction_id: string;
  order_id: string;
  gross_amount: string;
  currency: string;
  payment_type: string;
  transaction_time: string;
  transaction_status: 'pending' | 'settlement' | 'capture' | 'deny' | 'expire' | 'cancel';
  va_numbers?: Array<{ bank: string; va_number: string }>;
  redirect_url?: string;
  masked_card?: string;
  fraud_status: string;
}

export interface MidtransErrorResponse {
  status_code?: string;
  status_message?: string;
  error_messages?: string[];
}

export type MidtransResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number | null; error: MidtransErrorResponse | { message: string; rawBody?: string } };

// ============================================================================
// CONFIGURATION
// ============================================================================

const MIDTRANS_BASE_URL = 'https://api.midtrans.com';
const MIDTRANS_TIMEOUT_MS = 30000; // 30 seconds

// ============================================================================
// AUTHENTICATION
// ============================================================================

function getAuthHeader(serverKey: string): string {
  // Basic Auth: Base64Encode("SERVER_KEY:")
  // Note the colon at the end (no password)
  const authString = `${serverKey}:`;
  const encoded = Buffer.from(authString, 'utf-8').toString('base64');
  return `Basic ${encoded}`;
}

// ============================================================================
// HELPERS
// ============================================================================

function safeJsonParse(text: string): unknown | null {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function isMidtransError(value: unknown): value is MidtransErrorResponse {
  if (!value || typeof value !== 'object') return false;
  const v = value as MidtransErrorResponse;
  return Boolean(v.status_code || v.status_message || v.error_messages);
}

// ============================================================================
// HTTP CLIENT
// ============================================================================

/**
 * Make an authenticated request to the Midtrans Core API
 *
 * @param path - API path (e.g., '/v2/charge' or '/v2/ORDER-101/status')
 * @param opts - Request options (method, body)
 * @returns Result object with ok/data or ok/error
 */
export async function midtransRequest<T = MidtransChargeResponse>(
  path: string,
  opts?: MidtransRequestOptions
): Promise<MidtransResult<T>> {
  if (typeof fetch !== 'function') {
    return {
      ok: false,
      status: null,
      error: { message: 'fetch is not available in this runtime' }
    };
  }

  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) {
    return {
      ok: false,
      status: null,
      error: { message: 'MIDTRANS_SERVER_KEY is not set' }
    };
  }

  const method = opts?.method || 'POST';
  const url = `${MIDTRANS_BASE_URL}${path}`;

  console.log(`[midtrans] ${method} ${path}`);

  // Prepare request
  const headers: Record<string, string> = {
    'Authorization': getAuthHeader(serverKey),
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  const init: RequestInit = {
    method,
    headers
  };

  if (opts?.body && method !== 'GET') {
    init.body = JSON.stringify(opts.body);
  }

  // Timeout handling
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), MIDTRANS_TIMEOUT_MS);
  init.signal = controller.signal;

  try {
    const response = await fetch(url, init);
    const responseText = await response.text();
    clearTimeout(timeoutId);

    console.log(`[midtrans] response status=${response.status} ${path}`);

    const parsed = safeJsonParse(responseText);

    if (!response.ok) {
      if (isMidtransError(parsed)) {
        return { ok: false, status: response.status, error: parsed };
      }

      const fallbackMessage = response.statusText || `HTTP ${response.status}`;
      return {
        ok: false,
        status: response.status,
        error: { message: fallbackMessage, rawBody: responseText || undefined }
      };
    }

    if (parsed === null) {
      return {
        ok: false,
        status: response.status,
        error: { message: 'Non-JSON response from Midtrans', rawBody: responseText || undefined }
      };
    }

    return { ok: true, status: response.status, data: parsed as T };
  } catch (e) {
    clearTimeout(timeoutId);

    if (e instanceof Error && e.name === 'AbortError') {
      console.error(`[midtrans] timeout ${path} after ${MIDTRANS_TIMEOUT_MS}ms`);
      return {
        ok: false,
        status: null,
        error: { message: `Midtrans API timeout after ${MIDTRANS_TIMEOUT_MS}ms` }
      };
    }

    console.error(`[midtrans] request error ${path}: ${String(e)}`);
    return {
      ok: false,
      status: null,
      error: { message: 'Midtrans API request failed', rawBody: String(e) }
    };
  }
}

// ============================================================================
// UTILITY FUNCTIONS (optional, for convenience)
// ============================================================================

/**
 * Create a charge transaction
 * Convenience wrapper for midtransRequest('/v2/charge', { method: 'POST', body })
 */
export async function createCharge(
  payload: unknown
): Promise<MidtransResult<MidtransChargeResponse>> {
  return midtransRequest<MidtransChargeResponse>('/v2/charge', {
    method: 'POST',
    body: payload
  });
}

/**
 * Get transaction status
 * Convenience wrapper for midtransRequest(`/v2/${orderId}/status`)
 */
export async function getStatus(
  orderId: string
): Promise<MidtransResult<MidtransChargeResponse>> {
  return midtransRequest<MidtransChargeResponse>(`/v2/${orderId}/status`, {
    method: 'GET'
  });
}
