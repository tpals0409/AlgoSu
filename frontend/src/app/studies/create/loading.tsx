/**
 * @file 스터디 생성 라우트 Suspense 폴백
 * @domain study
 * @layer page
 * @related Skeleton, AppLayout
 */

'use client';

import type { ReactNode } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';

export default function StudyCreateLoading(): ReactNode {
  return (
    <AppLayout>
      <div className="space-y-6" aria-busy="true" aria-label="스터디 생성 로딩 중">
        <Skeleton variant="text" width="30%" height={28} />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </AppLayout>
  );
}
