/**
 * @file 스터디 상세 라우트 Suspense 폴백
 * @domain study
 * @layer page
 * @related Skeleton, AppLayout
 */

'use client';

import type { ReactNode } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';

export default function StudyDetailLoading(): ReactNode {
  return (
    <AppLayout>
      <div className="space-y-6" aria-busy="true" aria-label="스터디 상세 로딩 중">
        <Skeleton variant="text" width="30%" height={28} />
        <SkeletonCard />
        <div className="grid gap-4 sm:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    </AppLayout>
  );
}
