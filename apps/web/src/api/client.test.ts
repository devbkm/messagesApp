import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError, apiRequest } from './client'

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) }
}

describe('apiRequest', () => {
  it('sends a persistent user id and the JSON body', async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { id: 'm1' }))

    const result = await apiRequest('/api/v1/messages', { method: 'POST', body: { subject: 'Hi', text: 'B' } })

    expect(result).toEqual({ id: 'm1' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://api.test/api/v1/messages')
    expect(init.headers['X-User-Id']).toMatch(/^[0-9a-f-]{36}$/)
    expect(init.headers['X-User-Id']).toBe(window.localStorage.getItem('inbox.userId'))
    expect(JSON.parse(init.body)).toEqual({ subject: 'Hi', text: 'B' })
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
