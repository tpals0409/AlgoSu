/**
 * @file 테스트 유틸리티 — SWR 캐시 격리 래퍼
 * @domain common
 * @layer test
 * @related swr.ts, SWRProvider
 */

import { SWRConfig } from 'swr';
import type { ReactNode } from 'react';

/**
 * SWR 테스트 래퍼 — 테스트 간 캐시 격리
 */
export function SWRTestWrapper({ children }: { readonly children: ReactNode }): ReactNode {
  return (
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      {children}
    </SWRConfig>
  );
}
