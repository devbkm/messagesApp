import { QueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';

import type { Message, MessageSummary } from '../api/types';
import { AppProviders } from '../AppProviders';
import { RootNavigator } from '../navigation/RootNavigator';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** Renders the whole app (navigation included) with a fresh, non-retrying query cache. */
export async function renderApp() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
  const result = await render(
    <AppProviders queryClient={queryClient} initialMetrics={metrics}>
      <RootNavigator />
    </AppProviders>,
  );
  return { ...result, queryClient };
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
