/**
 * @file SWR global configuration Provider
 * @domain common
 * @layer provider
 * @related swr.ts, layout.tsx
 */
'use client';

import { SWRConfig } from 'swr';
import { swrFetcher } from '@/lib/swr';
import { ApiError } from '@/lib/api';
import type { ReactNode } from 'react';

/**
 * SWR global Provider — fetcher, retry policy, cache config
 */
export function SWRProvider({ children }: { readonly children: ReactNode }): ReactNode {
  return (
    <SWRConfig
      value={{
        fetcher: swrFetcher,
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        shouldRetryOnError: (err: unknown) => {
          if (err instanceof ApiError && [401, 403, 404].includes(err.status)) {
            return false;
          }
          return true;
        },
        errorRetryCount: 3,
        dedupingInterval: 2000,
      }}
    >
      {children}
    </SWRConfig>
  );
}
