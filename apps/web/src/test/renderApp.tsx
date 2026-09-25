import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { vi } from 'vitest'

import type { AuthApi } from '../api/auth'
import { ApiError } from '../api/client'
import type { AuthSession, AuthUser, Message, MessageSummary } from '../api/types'
import { AuthProvider } from '../auth/AuthProvider'
import { routes } from '../router'

export const TEST_USER: AuthUser = {
  id: 'user-1',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  created_at: '2026-09-01T10:00:00Z',
}

export function session(user: AuthUser = TEST_USER): AuthSession {
  return { user, expires_at: '2026-10-09T10:00:00Z' }
}

export const notSignedIn = () => new ApiError(401, 'not_authenticated', 'Please log in to continue.')

/** A controllable auth API: signed in as TEST_USER unless overridden. */
export function fakeAuthApi(overrides: Partial<Record<keyof AuthApi, ReturnType<typeof vi.fn>>> = {}) {
  return {
    getMe: vi.fn().mockResolvedValue(TEST_USER),
    login: vi.fn().mockResolvedValue(session()),
    signup: vi.fn().mockResolvedValue(session()),
    logout: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

/** Signed out: the server says there is no session. */
export const signedOutAuthApi = () => fakeAuthApi({ getMe: vi.fn().mockRejectedValue(notSignedIn()) })

type FakeAuthApi = ReturnType<typeof fakeAuthApi>

/**
 * Renders the whole app (auth + routing) at `path` with a fresh, non-retrying cache.
 * `authApi` defaults to a signed-in fake; `'real'` uses the real API (tests that stub `fetch`).
 */
export function renderApp<A extends FakeAuthApi | 'real' = FakeAuthApi>(
  path = '/',
  { authApi = fakeAuthApi() as A }: { authApi?: A } = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  })
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const user = userEvent.setup()
  const result = render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider api={authApi === 'real' ? undefined : (authApi as unknown as AuthApi)}>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>,
  )
  return { ...result, user, router, queryClient, authApi }
}

/** A promise whose settlement the test controls, to observe in-flight states. */
export function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

export function summary(overrides: Partial<MessageSummary> = {}): MessageSummary {
  return {
    id: 'msg-1',
    subject: 'Quarterly report',
    created_at: '2026-09-25T07:28:00Z',
    has_attachment: false,
    ...overrides,
  }
}

export function fullMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-1',
    subject: 'Quarterly report',
    text: 'Here is the full text of the message.',
    created_at: '2026-09-25T07:28:00Z',
    attachment: null,
    ...overrides,
  }
}
