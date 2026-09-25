import { ApiError } from '../api/client'

/** Turns any thrown value into a short, user-facing sentence. Never exposes internals. */
export function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.isNetworkError) {
      return "Can't reach the server. Check your connection and try again."
    }
    if (error.status === 404) return 'This message no longer exists.'
    if (error.status === 422) return 'Some details are invalid. Check the form and try again.'
    if (error.status === 503) return 'The service is temporarily unavailable. Please try again shortly.'
  }
  return 'Something went wrong. Please try again.'
}

export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404
}
