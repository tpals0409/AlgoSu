/**
 * @file AI 분석 결과 라우트 Suspense 폴백
 * @domain submission
 * @layer page
 * @related Skeleton, AppLayout
 */

'use client';

import type { ReactNode } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';

export default function AnalysisLoading(): ReactNode {
  return (
    <AppLayout>
      <div className="space-y-6" aria-busy="true" aria-label="AI 분석 로딩 중">
        <div className="flex items-center gap-3">
          <Skeleton width={32} height={32} className="rounded-md" />
          <Skeleton width="40%" height={24} />
        </div>
        <div className="rounded-card border border-border bg-bg-card p-6 shadow-card">
          <div className="flex items-center gap-4 mb-4">
            <Skeleton variant="circle" width={56} height={56} />
            <Skeleton width="25%" height={20} />
          </div>
          <Skeleton variant="text" lines={4} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    </AppLayout>
  );
}
