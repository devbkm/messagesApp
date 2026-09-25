import { getToken } from '../auth/tokenStorage';
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
  /** Send the session token (default). Sign-up and login send none. */
  authenticated?: boolean;
  /** Report a 401 to the auth layer, which signs the user out (default: when authenticated). */
  reportUnauthorized?: boolean;
};

type UnauthorizedHandler = (error: ApiError) => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

/**
 * Registers the auth layer's reaction to an expired or revoked session: any
 * authenticated request answered with 401 signs the user out. Returns an unsubscribe.
 */
export function setUnauthorizedHandler(handler: UnauthorizedHandler): () => void {
  unauthorizedHandler = handler;
  return () => {
    if (unauthorizedHandler === handler) unauthorizedHandler = null;
  };
}

/** The server answered, but not with the shape the app expects. */
export function invalidResponse(): ApiError {
  return new ApiError(200, 'invalid_response', 'Unexpected response from the server.');
}

/** Performs a JSON request as the current user and throws `ApiError` on any failure. */
export async function apiRequest<T>(
  path: string,
  { method = 'GET', body, authenticated = true, reportUnauthorized = authenticated }: RequestOptions = {},
): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    const token = authenticated ? await getToken() : null;
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
    const error = toApiError(response.status, payload);
    if (response.status === 401 && reportUnauthorized) unauthorizedHandler?.(error);
    throw error;
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
