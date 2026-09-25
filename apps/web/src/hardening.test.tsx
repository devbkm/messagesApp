/**
 * Reliability and edge cases, exercised through the real API client with `fetch`
 * stubbed, so response checking, timeouts and error mapping are covered end to end.
 */
import { render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getMessage, listMessages } from './api/messages'
import { RouteErrorPage } from './pages/RouteErrorPage'
import { renderApp } from './test/renderApp'
import { describeError } from './utils/errors'
import { validateMessage } from './utils/validation'

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function reply(status: number, body?: unknown) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => (body === undefined ? Promise.reject(new SyntaxError('no body')) : Promise.resolve(body)),
  })
}

const summary = (id: string, subject: string) => ({
  id,
  subject,
  created_at: '2026-09-25T07:28:00Z',
  has_attachment: false,
})

const notFound = () => reply(404, { error: { code: 'not_found', message: 'Message not found.' } })

/** Routes stubbed requests by method and path. */
function serve(routes: Record<string, () => Promise<unknown>>) {
  fetchMock.mockImplementation((url: string, init: { method: string }) => {
    const key = `${init.method} ${url.replace('http://api.test', '')}`
    const handler = routes[key]
    if (!handler) throw new Error(`Unexpected request: ${key}`)
    return handler()
  })
}

describe('invalid and malformed responses', () => {
  it.each([
    ['non-JSON body', () => reply(200)],
    ['wrong shape', () => reply(200, { messages: [] })],
    ['bad item', () => reply(200, { items: [{ id: 1, subject: null }] })],
    ['bad date', () => reply(200, { items: [{ ...summary('a', 'x'), created_at: 'yesterday' }] })],
  ])('rejects a %s as an invalid response', async (_name, response) => {
    fetchMock.mockImplementation(response)

    await expect(listMessages()).rejects.toMatchObject({ code: 'invalid_response' })
  })

  it('shows a recoverable error instead of crashing the inbox', async () => {
    serve({ 'GET /api/v1/messages': () => reply(200, '<html>proxy error</html>') })

    renderApp()

    expect(await screen.findByText("Couldn't load your messages")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(screen.queryByText(/proxy error/)).not.toBeInTheDocument()
  })
})

describe('slow network', () => {
  it('gives up after 15 seconds with a clear message', async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementation(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
        }),
    )

    const request = getMessage('m1').catch((error: unknown) => error)
    await vi.advanceTimersByTimeAsync(15_000)
    const error = await request

    expect(error).toMatchObject({ code: 'timeout' })
    expect(describeError(error)).toBe('The server is taking too long to respond. Please try again.')
  })
})

describe('message deleted elsewhere', () => {
  it('treats a delete of an already-deleted message as done', async () => {
    let listed = false
    serve({
      // First load still shows it; the server no longer has it afterwards.
      'GET /api/v1/messages': () =>
        reply(200, { items: listed ? [] : ((listed = true), [summary('gone', 'Deleted in another tab')]) }),
      'DELETE /api/v1/messages/gone': notFound,
    })
    const { user } = renderApp()

    await user.click(await screen.findByRole('button', { name: 'Delete message: Deleted in another tab' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))

    expect(await screen.findByText('Your inbox is empty')).toBeInTheDocument()
    expect(screen.queryByText(/Couldn't delete/)).not.toBeInTheDocument()
  })

  it('removes the stale row when opening it reveals it is gone', async () => {
    let listed = false
    const kept = summary('kept', 'Still here')
    serve({
      // The first load predates the deletion; later loads no longer include it.
      'GET /api/v1/messages': () =>
        reply(200, { items: listed ? [kept] : ((listed = true), [summary('gone', 'Deleted in another tab'), kept]) }),
      'GET /api/v1/messages/gone': notFound,
    })
    const { user } = renderApp()

    await user.click(await screen.findByRole('link', { name: /Deleted in another tab/ }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Message not found' })).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Back to inbox' }))

    expect(await screen.findByRole('link', { name: /Still here/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Deleted in another tab/ })).not.toBeInTheDocument()
  })
})

describe('content edge cases', () => {
  it('counts emoji as one character each, like the server', () => {
    expect(validateMessage({ subject: '😀'.repeat(40), text: 'x' })).toEqual({})
    expect(validateMessage({ subject: '😀'.repeat(41), text: 'x' }).subject).toBe(
      'Subject is 1 character too long (max 40).',
    )
  })

  it('rejects the same invisible and control characters as the server', () => {
    expect(validateMessage({ subject: '​​', text: 'x' }).subject).toBe('Enter a subject.')
    expect(validateMessage({ subject: 'one\ntwo', text: 'x' }).subject).toBe('Subject must be a single line.')
    expect(validateMessage({ subject: 'Hi', text: 'bell\u0007' }).text).toBe('Message contains unsupported characters.')
    expect(validateMessage({ subject: 'Hi', text: 'line\n\tbreaks are fine' })).toEqual({})
  })

  it('renders markup and Unicode as inert text', async () => {
    const subject = '<img src=x onerror=alert(1)> 😀 مرحبا'
    serve({ 'GET /api/v1/messages': () => reply(200, { items: [summary('m', subject)] }) })

    renderApp()

    expect(await screen.findByText(subject)).toBeInTheDocument()
    expect(document.querySelector('main img')).toBeNull()
  })

  it('renders a long inbox', async () => {
    const items = Array.from({ length: 500 }, (_, i) => summary(`m${i}`, `Message ${i}`))
    serve({ 'GET /api/v1/messages': () => reply(200, { items }) })

    renderApp()

    expect(await screen.findByText('500 messages')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(500)
  })

  it('shows 40/40 for a 40-emoji subject in the form', async () => {
    const { user } = renderApp('/messages/new')

    await user.type(await screen.findByRole('textbox', { name: 'Subject (required)' }), '😀'.repeat(40))

    expect(screen.getByText('40/40')).toBeInTheDocument()
    expect(screen.queryByText(/too long/)).not.toBeInTheDocument()
  })
})

describe('user identity', () => {
  it('is kept across visits (page reloads)', async () => {
    window.localStorage.clear()
    vi.resetModules()
    const first = (await import('./identity/userId')).getUserId()
    vi.resetModules()
    const second = (await import('./identity/userId')).getUserId()

    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(second).toBe(first)
  })

  it('still works outside a secure context (no crypto.randomUUID)', async () => {
    vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) })
    const { newUuid } = await import('./identity/userId')

    const ids = new Set(Array.from({ length: 50 }, () => newUuid()))

    expect(ids.size).toBe(50)
    for (const id of ids) {
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    }
  })

  it('still works when storage is blocked', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError')
    })
    vi.resetModules()
    const { getUserId } = await import('./identity/userId')

    expect(getUserId()).toMatch(/^[0-9a-f-]{36}$/)
    vi.restoreAllMocks()
  })
})

describe('unexpected errors', () => {
  it('shows a recoverable page without internal details', async () => {
    const Broken = () => {
      throw new Error('render failure with internal details')
    }
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const router = createMemoryRouter([{ path: '/', element: <Broken />, errorElement: <RouteErrorPage /> }])

    render(
      <QueryClientProvider client={new QueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    )

    expect(await screen.findByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to inbox' })).toHaveAttribute('href', '/')
    expect(screen.queryByText(/internal details/)).not.toBeInTheDocument()
    await waitFor(() => expect(console.error).toHaveBeenCalled())
    vi.restoreAllMocks()
  })
})
