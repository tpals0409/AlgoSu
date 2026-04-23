/**
 * @file 공유 링크 라우트 Suspense 폴백
 * @domain share
 * @layer page
 * @related Skeleton
 */

'use client';

import type { ReactNode } from 'react';
import { Skeleton, SkeletonListPage } from '@/components/ui/Skeleton';

export default function SharedLoading(): ReactNode {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6" aria-busy="true" aria-label="공유 페이지 로딩 중">
      <div className="flex items-center gap-3">
        <Skeleton width={32} height={32} className="rounded-md" />
        <Skeleton width="30%" height={24} />
      </div>
      <SkeletonListPage rows={6} />
    </div>
  );
}
