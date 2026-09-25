import { useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import { authApi as defaultAuthApi, type AuthApi } from '../api/auth'
import { ApiError, setUnauthorizedHandler } from '../api/client'
import type { AuthUser, LoginInput, SignupInput } from '../api/types'
import { describeError } from '../utils/errors'

/**
 * - `checking`: asking the server whether the session cookie is still valid.
 * - `error`: the server could not be reached to answer that; the user can retry.
 */
type AuthState =
  | { status: 'checking' }
  | { status: 'error'; error: unknown }
  | { status: 'signedOut'; notice?: string }
  | { status: 'signedIn'; user: AuthUser }

type AuthContextValue = AuthState & {
  signIn: (input: LoginInput) => Promise<void>
  signUp: (input: SignupInput) => Promise<void>
  signOut: () => Promise<void>
  retry: () => void
  dismissNotice: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

/**
 * Owns the signed-in state. The browser cannot read the httpOnly session cookie, so the
 * app never guesses: it asks the server (GET /auth/me) on load, and any later 401 signs
 * the user out.
 */
export function AuthProvider({ children, api = defaultAuthApi }: { children: ReactNode; api?: AuthApi }) {
  const queryClient = useQueryClient()
  const [state, setState] = useState<AuthState>({ status: 'checking' })

  useEffect(() => {
    let active = true
    void loadSession(api).then((next) => {
      if (active) setState(next)
    })
    return () => {
      active = false
    }
  }, [api])

  // A session that expires or is revoked while the page is open.
  useEffect(
    () =>
      setUnauthorizedHandler((error) => {
        queryClient.clear()
        setState({ status: 'signedOut', notice: describeError(error) })
      }),
    [queryClient],
  )

  const startSession = useCallback(
    (user: AuthUser) => {
      queryClient.clear() // never show a previous user's cached data
      setState({ status: 'signedIn', user })
    },
    [queryClient],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      signIn: async (input) => startSession((await api.login(input)).user),
      signUp: async (input) => startSession((await api.signup(input)).user),
      signOut: async () => {
        try {
          await api.logout()
        } catch {
          // Still sign out locally; the server session expires on its own.
        }
        queryClient.clear()
        setState({ status: 'signedOut' })
      },
      retry: () => {
        setState({ status: 'checking' })
        void loadSession(api).then(setState)
      },
      dismissNotice: () => setState((current) => (current.status === 'signedOut' ? { status: 'signedOut' } : current)),
    }),
    [api, queryClient, startSession, state],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

async function loadSession(api: AuthApi): Promise<AuthState> {
  try {
    return { status: 'signedIn', user: await api.getMe() }
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      // No session, or it expired. Only an expired one deserves an explanation.
      return error.code === 'session_expired'
        ? { status: 'signedOut', notice: describeError(error) }
        : { status: 'signedOut' }
    }
    return { status: 'error', error }
  }
}

// eslint-disable-next-line react/only-export-components -- hook belongs with its provider
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}
