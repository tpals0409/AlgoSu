/**
 * @file SWR 글로벌 설정 Provider
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
 * SWR 글로벌 Provider — fetcher, 재시도 정책, 캐시 설정
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
