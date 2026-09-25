import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'

import type { Message, MessageSummary } from '../api/types'
import { routes } from '../router'

/** Renders the whole app (routing included) at `path` with a fresh, non-retrying cache. */
export function renderApp(path = '/') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  })
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const user = userEvent.setup()
  const result = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return { ...result, user, router, queryClient }
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
