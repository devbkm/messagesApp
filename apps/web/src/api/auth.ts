import { apiRequest, invalidResponse } from './client'
import type { AuthSession, AuthUser, LoginInput, SignupInput } from './types'

const BASE = '/api/v1/auth'

// Sign-up and login answer 401/409/422 for bad input; those are form errors, not an
// expired session, so they are not reported to the auth layer.

export async function signup(input: SignupInput): Promise<AuthSession> {
  const data = await apiRequest<unknown>(`${BASE}/signup`, { method: 'POST', body: input, reportUnauthorized: false })
  if (!isSession(data)) throw invalidResponse()
  return data
}

export async function login(input: LoginInput): Promise<AuthSession> {
  const data = await apiRequest<unknown>(`${BASE}/login`, { method: 'POST', body: input, reportUnauthorized: false })
  if (!isSession(data)) throw invalidResponse()
  return data
}

/** Asks the server who is signed in (the cookie is not readable by scripts). */
export async function getMe(): Promise<AuthUser> {
  const data = await apiRequest<unknown>(`${BASE}/me`, { reportUnauthorized: false })
  if (!isUser(data)) throw invalidResponse()
  return data
}

/** Ends the session on the server and clears the cookie. */
export function logout(): Promise<void> {
  return apiRequest<void>(`${BASE}/logout`, { method: 'POST', reportUnauthorized: false })
}

export type AuthApi = {
  signup: typeof signup
  login: typeof login
  getMe: typeof getMe
  logout: typeof logout
}

export const authApi: AuthApi = { signup, login, getMe, logout }

// --- Response guards ---------------------------------------------------------------

type Json = Record<string, unknown>
const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null
const isString = (value: unknown): value is string => typeof value === 'string'

function isUser(value: unknown): value is AuthUser {
  return isObject(value) && isString(value.id) && isString(value.name) && isString(value.email) && isString(value.created_at)
}

function isSession(value: unknown): value is AuthSession {
  return isObject(value) && isUser(value.user)
}
