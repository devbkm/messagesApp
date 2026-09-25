import type { ApiErrorBody } from './types'

const REQUEST_TIMEOUT_MS = 15_000

/**
 * An API failure normalised for the UI. `status` is 0 when no HTTP response was
 * received (offline, timeout, server unreachable).
 */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly fieldErrors: Record<string, string>

  constructor(status: number, code: string, message: string, fieldErrors: Record<string, string> = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fieldErrors = fieldErrors
  }

  get isNetworkError() {
    return this.status === 0
  }
}

/** The API origin; empty means the same origin as the page (the dev server proxies /api). */
export function getApiBaseUrl(): string {
  return (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '')
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
  /** Report a 401 to the auth layer, which signs the user out (default true). */
  reportUnauthorized?: boolean
}

type UnauthorizedHandler = (error: ApiError) => void
let unauthorizedHandler: UnauthorizedHandler | null = null

/**
 * Registers the auth layer's reaction to an expired or revoked session: any request
 * answered with 401 signs the user out. Returns an unsubscribe.
 */
export function setUnauthorizedHandler(handler: UnauthorizedHandler): () => void {
  unauthorizedHandler = handler
  return () => {
    if (unauthorizedHandler === handler) unauthorizedHandler = null
  }
}

/** The server answered, but not with the shape the app expects. */
export function invalidResponse(): ApiError {
  return new ApiError(200, 'invalid_response', 'Unexpected response from the server.')
}

/**
 * Performs a JSON request and throws `ApiError` on any failure.
 *
 * The session lives in an httpOnly cookie that scripts cannot read; the browser sends
 * it (`credentials: 'include'`), and the `X-Auth-Transport` header tells the API to
 * accept it. That custom header is also what protects against cross-site requests.
 */
export async function apiRequest<T>(
  path: string,
  { method = 'GET', body, signal, reportUnauthorized = true }: RequestOptions = {},
): Promise<T> {
  const controller = new AbortController()
  let timedOut = false
  const timeout = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, REQUEST_TIMEOUT_MS)
  // Honour cancellation from TanStack Query (e.g. when a page unmounts).
  signal?.addEventListener('abort', () => controller.abort(), { once: true })

  let response: Response
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      method,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'X-Auth-Transport': 'cookie',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (signal?.aborted) throw error
    if (timedOut) throw new ApiError(0, 'timeout', 'The server took too long to respond.')
    throw new ApiError(0, 'network_error', 'Could not reach the server.')
  } finally {
    clearTimeout(timeout)
  }

  if (response.status === 204) {
    return undefined as T
  }

  const payload: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    const error = toApiError(response.status, payload)
    if (response.status === 401 && reportUnauthorized) unauthorizedHandler?.(error)
    throw error
  }
  return payload as T
}

function toApiError(status: number, payload: unknown): ApiError {
  if (isErrorBody(payload)) {
    const fieldErrors: Record<string, string> = {}
    for (const detail of payload.error.details ?? []) {
      // "body.subject" -> "subject"
      const field = detail.field.split('.').pop() ?? detail.field
      fieldErrors[field] ??= detail.message
    }
    return new ApiError(status, payload.error.code, payload.error.message, fieldErrors)
  }
  return new ApiError(status, 'unknown_error', 'Unexpected response from the server.')
}

function isErrorBody(payload: unknown): payload is ApiErrorBody {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'error' in payload &&
    typeof (payload as ApiErrorBody).error?.message === 'string'
  )
}
