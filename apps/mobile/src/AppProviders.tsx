import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { createQueryClient, subscribeToAppFocus } from './api/queryClient';

type AppProvidersProps = {
  children: ReactNode;
  /** Injected by tests; the app creates its own. */
  queryClient?: QueryClient;
  initialMetrics?: Metrics;
};

export function AppProviders({ children, queryClient, initialMetrics }: AppProvidersProps) {
  const [client] = useState(() => queryClient ?? createQueryClient());

  useEffect(() => subscribeToAppFocus(), []);

  return (
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </SafeAreaProvider>
  );
}
