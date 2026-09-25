import { QueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';

import type { AuthApi } from '../api/auth';
import type { AuthSession, AuthUser, Message, MessageSummary } from '../api/types';
import { AppProviders } from '../AppProviders';
import { resetTokenCacheForTests, setToken } from '../auth/tokenStorage';
import { RootNavigator } from '../navigation/RootNavigator';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

export const TEST_USER: AuthUser = {
  id: 'user-1',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  created_at: '2026-09-01T10:00:00Z',
};

export function session(user: AuthUser = TEST_USER, token = 'session-token'): AuthSession {
  return { user, token, expires_at: '2026-10-09T10:00:00Z' };
}

/** A controllable auth API: signed in as TEST_USER unless overridden. */
export function fakeAuthApi(overrides: Partial<Record<keyof AuthApi, jest.Mock>> = {}) {
  return {
    getMe: jest.fn().mockResolvedValue(TEST_USER),
    login: jest.fn().mockResolvedValue(session()),
    signup: jest.fn().mockResolvedValue(session()),
    logout: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

type RenderAppOptions = {
  /** Start with a stored session token (default true). */
  signedIn?: boolean;
  /** `'real'` uses the real auth API (tests that mock `fetch`). */
  authApi?: ReturnType<typeof fakeAuthApi> | 'real';
};

/** Renders the whole app (auth + navigation) with a fresh, non-retrying query cache. */
export async function renderApp({ signedIn = true, authApi = fakeAuthApi() }: RenderAppOptions = {}) {
  await resetStoredSession();
  if (signedIn) await setToken('session-token');
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
  const result = await render(
    <AppProviders
      queryClient={queryClient}
      initialMetrics={metrics}
      authApi={authApi === 'real' ? undefined : (authApi as unknown as AuthApi)}
    >
      <RootNavigator />
    </AppProviders>,
  );
  return { ...result, queryClient, authApi };
}

/** Clears secure storage and the in-memory token, as on a fresh install. */
export async function resetStoredSession() {
  (SecureStore as unknown as { __store: Map<string, string> }).__store.clear();
  resetTokenCacheForTests();
}

/** A promise whose settlement the test controls, to observe in-flight states. */
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

export function summary(overrides: Partial<MessageSummary> = {}): MessageSummary {
  return {
    id: 'msg-1',
    subject: 'Quarterly report',
    created_at: '2026-09-25T07:28:00Z',
    has_attachment: false,
    ...overrides,
  };
}

export function fullMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-1',
    subject: 'Quarterly report',
    text: 'Here is the full text of the message.',
    created_at: '2026-09-25T07:28:00Z',
    attachment: null,
    ...overrides,
  };
}

/** Resets only the given module mocks (not the Expo preset's own mocks). */
export function resetMocks(module: Record<string, unknown>) {
  for (const fn of Object.values(module)) {
    if (jest.isMockFunction(fn)) fn.mockReset();
  }
}
