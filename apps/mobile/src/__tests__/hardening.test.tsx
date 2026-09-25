/**
 * Reliability and edge cases, exercised through the real API client with `fetch`
 * mocked, so response checking, timeouts and error mapping are covered end to end.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { Text } from 'react-native';

import { ApiError } from '../api/client';
import { getMessage, listMessages } from '../api/messages';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { navigationRef } from '../navigation/RootNavigator';
import { renderApp } from '../test-utils/renderApp';
import { describeError } from '../utils/errors';
import { validateMessage } from '../utils/validation';

// The Expo preset stubs native modules; use Node's real UUID generator instead.
jest.mock('expo-crypto', () => ({ randomUUID: () => globalThis.crypto.randomUUID() }));

const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock;
});

afterEach(() => {
  jest.useRealTimers();
});

function reply(status: number, body?: unknown) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => (body === undefined ? Promise.reject(new SyntaxError('no body')) : Promise.resolve(body)),
  });
}

const summary = (id: string, subject: string) => ({
  id,
  subject,
  created_at: '2026-09-25T07:28:00Z',
  has_attachment: false,
});

/** Routes mocked requests by method and path. */
function serve(routes: Record<string, () => Promise<unknown>>) {
  fetchMock.mockImplementation((url: string, init: { method: string }) => {
    const key = `${init.method} ${url.replace('http://api.test', '')}`;
    const handler = routes[key];
    if (!handler) throw new Error(`Unexpected request: ${key}`);
    return handler();
  });
}

describe('invalid and malformed responses', () => {
  it.each([
    ['non-JSON body', () => reply(200)],
    ['wrong shape', () => reply(200, { messages: [] })],
    ['bad item', () => reply(200, { items: [{ id: 1, subject: null }] })],
    ['bad date', () => reply(200, { items: [{ ...summary('a', 'x'), created_at: 'yesterday' }] })],
  ])('rejects a %s as an invalid response', async (_name, response) => {
    fetchMock.mockImplementation(response);

    await expect(listMessages()).rejects.toMatchObject({ code: 'invalid_response' });
  });

  it('shows a recoverable error instead of crashing the inbox', async () => {
    serve({ 'GET /api/v1/messages': () => reply(200, '<html>proxy error</html>') });

    await renderApp();

    expect(await screen.findByText("Couldn't load your messages")).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeOnTheScreen();
    expect(screen.queryByText(/proxy error/)).not.toBeOnTheScreen();
  });
});

describe('slow network', () => {
  it('gives up after 15 seconds with a clear message', async () => {
    jest.useFakeTimers();
    fetchMock.mockImplementation(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => reject(new Error('Aborted')));
        }),
    );

    const request = getMessage('m1').catch((error: unknown) => error);
    await jest.advanceTimersByTimeAsync(15_000);
    const error = await request;

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 'timeout' });
    expect(describeError(error)).toBe('The server is taking too long to respond. Please try again.');
  });
});

describe('message deleted elsewhere', () => {
  it('treats a delete of an already-deleted message as done', async () => {
    let listed = false;
    serve({
      // First load still shows it; the server no longer has it afterwards.
      'GET /api/v1/messages': () =>
        reply(200, { items: listed ? [] : ((listed = true), [summary('gone', 'Deleted on laptop')]) }),
      'DELETE /api/v1/messages/gone': () => reply(404, { error: { code: 'not_found', message: 'Message not found.' } }),
    });
    await renderApp();

    await fireEvent.press(await screen.findByRole('button', { name: 'Delete message: Deleted on laptop' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('Your inbox is empty')).toBeOnTheScreen();
    expect(screen.queryByText(/Couldn't delete/)).not.toBeOnTheScreen();
  });

  it('removes the stale row when opening it reveals it is gone', async () => {
    serve({
      'GET /api/v1/messages': () =>
        reply(200, { items: [summary('gone', 'Deleted on laptop'), summary('kept', 'Still here')] }),
      'GET /api/v1/messages/gone': () => reply(404, { error: { code: 'not_found', message: 'Message not found.' } }),
    });
    await renderApp();

    await fireEvent.press(await screen.findByText('Deleted on laptop'));
    expect(await screen.findByText('Message not found')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Back to inbox' }));

    expect(await screen.findByText('Still here')).toBeOnTheScreen();
    expect(screen.queryByText('Deleted on laptop')).not.toBeOnTheScreen();
  });
});

describe('content edge cases', () => {
  it('counts emoji as one character each, like the server', () => {
    expect(validateMessage({ subject: '😀'.repeat(40), text: 'x' })).toEqual({});
    expect(validateMessage({ subject: '😀'.repeat(41), text: 'x' }).subject).toBe(
      'Subject is 1 character too long (max 40).',
    );
  });

  it('rejects the same invisible and control characters as the server', () => {
    expect(validateMessage({ subject: '​​', text: 'x' }).subject).toBe('Enter a subject.');
    expect(validateMessage({ subject: 'one\ntwo', text: 'x' }).subject).toBe('Subject must be a single line.');
    expect(validateMessage({ subject: 'Hi', text: 'bell\u0007' }).text).toBe('Message contains unsupported characters.');
    expect(validateMessage({ subject: 'Hi', text: 'line\n\tbreaks are fine' })).toEqual({});
  });

  it('renders markup and Unicode as plain text', async () => {
    const subject = '<img src=x onerror=alert(1)> 😀 مرحبا';
    serve({ 'GET /api/v1/messages': () => reply(200, { items: [summary('m', subject)] }) });

    await renderApp();

    expect(await screen.findByText(subject)).toBeOnTheScreen();
  });

  it('virtualises a long inbox', async () => {
    const items = Array.from({ length: 300 }, (_, i) => summary(`m${i}`, `Message ${i}`));
    serve({ 'GET /api/v1/messages': () => reply(200, { items }) });

    await renderApp();

    expect(await screen.findByText('300 messages')).toBeOnTheScreen();
    expect(screen.getByText('Message 0')).toBeOnTheScreen();
    // Only the first screenfuls are mounted; the rest render on scroll.
    expect(screen.queryByText('Message 299')).not.toBeOnTheScreen();
  });

  it('shows 40/40 for a 40-emoji subject in the form', async () => {
    serve({ 'GET /api/v1/messages': () => reply(200, { items: [] }) });
    await renderApp();
    await act(() => navigationRef.navigate('CreateMessage'));

    await fireEvent.changeText(await screen.findByLabelText('Subject, required'), '😀'.repeat(40));

    expect(screen.getByText('40/40')).toBeOnTheScreen();
    expect(screen.queryByText(/too long/)).not.toBeOnTheScreen();
  });
});

describe('reopening the app', () => {
  it('reuses the stored user id so the same inbox is shown', async () => {
    await AsyncStorage.clear();
    // A fresh module instance per load simulates a cold start of the app.
    const load = (): typeof import('../identity/userId') => {
      let loaded!: typeof import('../identity/userId');
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        loaded = require('../identity/userId');
      });
      return loaded;
    };

    const first = await load().getUserId();
    const second = await load().getUserId();

    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    expect(second).toBe(first);
  });
});

describe('unexpected errors', () => {
  it('shows a recoverable screen instead of a blank app', async () => {
    let broken = true;
    const Flaky = () => {
      if (broken) throw new Error('render failure with internal details');
      return <Text>Recovered</Text>;
    };
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await render(
      <ErrorBoundary>
        <Flaky />
      </ErrorBoundary>,
    );

    const alert = screen.getByRole('alert');
    expect(within(alert).getByText('Something went wrong')).toBeOnTheScreen();
    expect(screen.queryByText(/internal details/)).not.toBeOnTheScreen();

    broken = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.getByText('Recovered')).toBeOnTheScreen());
    spy.mockRestore();
  });
});
