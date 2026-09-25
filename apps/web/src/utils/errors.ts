import { ApiError } from '../api/client'

/** Turns any thrown value into a short, user-facing sentence. Never exposes internals. */
export function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'email_taken':
        return 'An account with this email already exists. Log in instead, or use another email.'
      case 'invalid_credentials':
        return 'Invalid email or password.'
      case 'session_expired':
        return 'Your session has expired. Please log in again.'
      case 'invalid_session':
      case 'not_authenticated':
        return 'Please log in again to continue.'
    }
    if (error.code === 'timeout') {
      return 'The server is taking too long to respond. Please try again.'
    }
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
