/**
 * @file 대시보드 라우트 Suspense 폴백
 * @domain dashboard
 * @layer page
 * @related Skeleton, AppLayout
 */

'use client';

import type { ReactNode } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { SkeletonDashboard } from '@/components/ui/Skeleton';

export default function DashboardLoading(): ReactNode {
  return (
    <AppLayout>
      <SkeletonDashboard />
    </AppLayout>
  );
}
