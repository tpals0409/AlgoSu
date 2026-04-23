/**
 * @file 제출 상태 라우트 Suspense 폴백
 * @domain submission
 * @layer page
 * @related Skeleton, AppLayout
 */

'use client';

import type { ReactNode } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';

export default function SubmissionStatusLoading(): ReactNode {
  return (
    <AppLayout>
      <div className="space-y-6" aria-busy="true" aria-label="제출 상태 로딩 중">
        <div className="flex items-center gap-3">
          <Skeleton width={32} height={32} className="rounded-md" />
          <Skeleton width="35%" height={24} />
        </div>
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </AppLayout>
  );
}
