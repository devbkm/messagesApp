import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError, apiRequest, setUnauthorizedHandler } from './client'

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) }
}

describe('apiRequest', () => {
  it('sends the session cookie with the transport header, never a token', async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { id: 'm1' }))

    const result = await apiRequest('/api/v1/messages', { method: 'POST', body: { subject: 'Hi', text: 'B' } })

    expect(result).toEqual({ id: 'm1' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://api.test/api/v1/messages')
    expect(init.credentials).toBe('include')
    expect(init.headers['X-Auth-Transport']).toBe('cookie')
    expect(init.headers.Authorization).toBeUndefined()
    expect(JSON.parse(init.body)).toEqual({ subject: 'Hi', text: 'B' })
  })

  it('reports a 401 so the user is signed out, unless asked not to', async () => {
    const handler = vi.fn()
    const unsubscribe = setUnauthorizedHandler(handler)
    fetchMock.mockResolvedValue(jsonResponse(401, { error: { code: 'session_expired', message: 'Expired' } }))

    await expect(apiRequest('/x', { reportUnauthorized: false })).rejects.toMatchObject({ status: 401 })
    expect(handler).not.toHaveBeenCalled()
    await expect(apiRequest('/x')).rejects.toMatchObject({ status: 401 })
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ code: 'session_expired' }))
    unsubscribe()
  })

  it('maps the error envelope, including field errors', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(422, {
        error: {
          code: 'validation_error',
          message: 'The request is invalid.',
          details: [{ field: 'body.subject', message: 'Too long' }],
        },
      }),
    )

    await expect(apiRequest('/x')).rejects.toMatchObject({
      status: 422,
      code: 'validation_error',
      fieldErrors: { subject: 'Too long' },
    })
  })

  it('turns network failures into a network error', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    const error = (await apiRequest('/x').catch((e: unknown) => e)) as ApiError

    expect(error).toBeInstanceOf(ApiError)
    expect(error.isNetworkError).toBe(true)
  })

  it('returns nothing for 204 and handles non-JSON errors', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 204, json: () => Promise.reject(new Error()) })
    await expect(apiRequest('/x', { method: 'DELETE' })).resolves.toBeUndefined()

    fetchMock.mockResolvedValueOnce({ ok: false, status: 502, json: () => Promise.reject(new SyntaxError()) })
    await expect(apiRequest('/x')).rejects.toMatchObject({ status: 502, code: 'unknown_error' })
  })
})
