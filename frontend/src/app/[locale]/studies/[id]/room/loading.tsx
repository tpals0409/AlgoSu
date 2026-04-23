/**
 * @file 스터디 룸 라우트 Suspense 폴백
 * @domain study
 * @layer page
 * @related Skeleton, AppLayout
 */

'use client';

import type { ReactNode } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Skeleton, SkeletonListPage } from '@/components/ui/Skeleton';

export default function StudyRoomLoading(): ReactNode {
  return (
    <AppLayout>
      <div className="space-y-6" aria-busy="true" aria-label="스터디 룸 로딩 중">
        <div className="flex items-center gap-3">
          <Skeleton width={32} height={32} className="rounded-md" />
          <Skeleton width="30%" height={24} />
        </div>
        <SkeletonListPage rows={6} />
      </div>
    </AppLayout>
  );
}
