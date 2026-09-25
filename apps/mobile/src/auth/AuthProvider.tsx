import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { authApi as defaultAuthApi, type AuthApi } from '../api/auth';
import { ApiError, setUnauthorizedHandler } from '../api/client';
import type { AuthUser, LoginInput, SignupInput } from '../api/types';
import { describeError } from '../utils/errors';
import { clearToken, getToken, setToken } from './tokenStorage';

/**
 * - `checking`: confirming a stored session with the server (app start).
 * - `error`: the server could not be reached to confirm it; the user can retry.
 */
type AuthState =
  | { status: 'checking' }
  | { status: 'error'; error: unknown }
  | { status: 'signedOut'; notice?: string }
  | { status: 'signedIn'; user: AuthUser };

type AuthContextValue = AuthState & {
  signIn: (input: LoginInput) => Promise<void>;
  signUp: (input: SignupInput) => Promise<void>;
  signOut: () => Promise<void>;
  retry: () => void;
  dismissNotice: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthProviderProps = {
  children: ReactNode;
  /** Injected by tests; the app uses the real API. */
  api?: AuthApi;
};

/**
 * Owns the signed-in state. A stored token is never trusted on its own: on start-up it
 * is confirmed with GET /auth/me, and any later 401 signs the user out.
 */
export function AuthProvider({ children, api = defaultAuthApi }: AuthProviderProps) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({ status: 'checking' });

  // Confirm any stored session once on start-up.
  useEffect(() => {
    let active = true;
    void loadStoredSession(api).then((next) => {
      if (active) setState(next);
    });
    return () => {
      active = false;
    };
  }, [api]);

  // A session that expires or is revoked while the app is in use.
  useEffect(
    () =>
      setUnauthorizedHandler((error) => {
        void clearToken();
        queryClient.clear();
        setState({ status: 'signedOut', notice: describeError(error) });
      }),
    [queryClient],
  );

  const startSession = useCallback(
    async (token: string, user: AuthUser) => {
      await setToken(token);
      queryClient.clear(); // never show a previous user's cached data
      setState({ status: 'signedIn', user });
    },
    [queryClient],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      signIn: async (input) => {
        const session = await api.login(input);
        await startSession(session.token, session.user);
      },
      signUp: async (input) => {
        const session = await api.signup(input);
        await startSession(session.token, session.user);
      },
      signOut: async () => {
        try {
          await api.logout();
        } catch {
          // Still sign out locally; the server session expires on its own.
        }
        await clearToken();
        queryClient.clear();
        setState({ status: 'signedOut' });
      },
      retry: () => {
        setState({ status: 'checking' });
        void loadStoredSession(api).then(setState);
      },
      dismissNotice: () => setState((current) => (current.status === 'signedOut' ? { status: 'signedOut' } : current)),
    }),
    [api, queryClient, startSession, state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** The state a stored token leads to, once the server has been asked about it. */
async function loadStoredSession(api: AuthApi): Promise<AuthState> {
  const token = await getToken();
  if (!token) return { status: 'signedOut' };
  try {
    return { status: 'signedIn', user: await api.getMe() };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      await clearToken();
      return { status: 'signedOut', notice: describeError(error) };
    }
    // Offline or server down: keep the token and let the user retry.
    return { status: 'error', error };
  }
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}

/** The signed-in user; only for screens rendered while signed in. */
export function useCurrentUser(): AuthUser {
  const auth = useAuth();
  if (auth.status !== 'signedIn') throw new Error('useCurrentUser requires a signed-in user');
  return auth.user;
}
