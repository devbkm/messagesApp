import { getUserId } from '../identity/userId';
import type { ApiErrorBody } from './types';

const REQUEST_TIMEOUT_MS = 15_000;

/**
 * An API failure normalised for the UI. `status` is 0 when no HTTP response was
 * received (offline, timeout, server unreachable).
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isNetworkError() {
    return this.status === 0;
  }
}

export function getApiBaseUrl(): string {
  const url = process.env.EXPO_PUBLIC_API_URL;
  if (!url) {
    throw new ApiError(0, 'not_configured', 'EXPO_PUBLIC_API_URL is not set.');
  }
  return url.replace(/\/+$/, '');
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
};

/** The server answered, but not with the shape the app expects. */
export function invalidResponse(): ApiError {
  return new ApiError(200, 'invalid_response', 'Unexpected response from the server.');
}

/** Performs a JSON request as the current user and throws `ApiError` on any failure. */
export async function apiRequest<T>(path: string, { method = 'GET', body }: RequestOptions = {}): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    const userId = await getUserId();
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        'X-User-Id': userId,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (timedOut) throw new ApiError(0, 'timeout', 'The server took too long to respond.');
    throw new ApiError(0, 'network_error', 'Could not reach the server.');
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw toApiError(response.status, payload);
  }
  return payload as T;
}

function toApiError(status: number, payload: unknown): ApiError {
  if (isErrorBody(payload)) {
    const fieldErrors: Record<string, string> = {};
    for (const detail of payload.error.details ?? []) {
      // "body.subject" -> "subject"
      const field = detail.field.split('.').pop() ?? detail.field;
      fieldErrors[field] ??= detail.message;
    }
    return new ApiError(status, payload.error.code, payload.error.message, fieldErrors);
  }
  return new ApiError(status, 'unknown_error', 'Unexpected response from the server.');
}

function isErrorBody(payload: unknown): payload is ApiErrorBody {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'error' in payload &&
    typeof (payload as ApiErrorBody).error?.message === 'string'
  );
}
