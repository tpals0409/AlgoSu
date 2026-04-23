/**
 * @file 문제 목록 라우트 Suspense 폴백
 * @domain problem
 * @layer page
 * @related Skeleton, AppLayout
 */

'use client';

import type { ReactNode } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { SkeletonListPage } from '@/components/ui/Skeleton';

export default function ProblemsLoading(): ReactNode {
  return (
    <AppLayout>
      <SkeletonListPage rows={8} />
    </AppLayout>
  );
}
