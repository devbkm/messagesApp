import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import type { AuthApi } from './api/auth';
import { createQueryClient, subscribeToAppFocus } from './api/queryClient';
import { AuthProvider } from './auth/AuthProvider';

type AppProvidersProps = {
  children: ReactNode;
  /** Injected by tests; the app creates its own. */
  queryClient?: QueryClient;
  initialMetrics?: Metrics;
  /** Injected by tests; the app uses the real auth API. */
  authApi?: AuthApi;
};

export function AppProviders({ children, queryClient, initialMetrics, authApi }: AppProvidersProps) {
  const [client] = useState(() => queryClient ?? createQueryClient());

  useEffect(() => subscribeToAppFocus(), []);

  return (
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <QueryClientProvider client={client}>
        <AuthProvider api={authApi}>{children}</AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
