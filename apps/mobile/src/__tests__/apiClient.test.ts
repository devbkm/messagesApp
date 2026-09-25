import { ApiError, apiRequest } from '../api/client';

jest.mock('../identity/userId', () => ({ getUserId: jest.fn().mockResolvedValue('user-123') }));

const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock;
});

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) };
}

describe('apiRequest', () => {
  it('sends the user id and JSON body, and returns the parsed response', async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { id: 'm1' }));

    const result = await apiRequest('/api/v1/messages', { method: 'POST', body: { subject: 'Hi', text: 'B' } });

    expect(result).toEqual({ id: 'm1' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/api/v1/messages');
    expect(init.method).toBe('POST');
    expect(init.headers['X-User-Id']).toBe('user-123');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({ subject: 'Hi', text: 'B' });
  });

  it('returns nothing for 204 responses', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 204, json: () => Promise.reject(new Error('no body')) });

    await expect(apiRequest('/x', { method: 'DELETE' })).resolves.toBeUndefined();
  });

  it('maps the error envelope, including field errors', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(422, {
        error: {
          code: 'validation_error',
          message: 'The request is invalid.',
          details: [{ field: 'body.subject', message: 'Too long' }],
        },
      }),
    );

    const error = await apiRequest('/x').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 422, code: 'validation_error', fieldErrors: { subject: 'Too long' } });
  });

  it('turns network failures into a network error', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));

    const error = (await apiRequest('/x').catch((e: unknown) => e)) as ApiError;

    expect(error.isNetworkError).toBe(true);
    expect(error.message).toBe('Could not reach the server.');
  });

  it('handles non-JSON error responses', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 502, json: () => Promise.reject(new SyntaxError('bad')) });

    await expect(apiRequest('/x')).rejects.toMatchObject({ status: 502, code: 'unknown_error' });
  });
});
