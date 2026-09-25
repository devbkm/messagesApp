import { focusManager, QueryClient } from '@tanstack/react-query';
import { AppState, Platform, type AppStateStatus } from 'react-native';

import { ApiError } from './client';

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Retry transient failures once; client errors (4xx) will not fix themselves.
        retry: (failureCount, error) =>
          failureCount < 1 && !(error instanceof ApiError && error.status >= 400 && error.status < 500),
      },
      mutations: {
        // Never replay a create/delete automatically; the user decides to retry.
        retry: false,
      },
    },
  });
}

/** Refetch stale queries when the app returns to the foreground. */
export function subscribeToAppFocus() {
  if (Platform.OS === 'web') return () => {};
  const subscription = AppState.addEventListener('change', (status: AppStateStatus) => {
    focusManager.setFocused(status === 'active');
  });
  return () => subscription.remove();
}
