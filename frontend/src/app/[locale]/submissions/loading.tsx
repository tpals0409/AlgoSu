/**
 * @file 제출 목록 라우트 Suspense 폴백
 * @domain submission
 * @layer page
 * @related Skeleton, AppLayout
 */

'use client';

import type { ReactNode } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { SkeletonListPage } from '@/components/ui/Skeleton';

export default function SubmissionsLoading(): ReactNode {
  return (
    <AppLayout>
      <SkeletonListPage rows={10} />
    </AppLayout>
  );
}
