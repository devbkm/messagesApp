import { QueryClient } from '@tanstack/react-query'

import { ApiError } from './client'

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
  })
}
