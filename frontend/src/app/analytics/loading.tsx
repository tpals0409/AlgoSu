/**
 * @file 분석 페이지 라우트 Suspense 폴백
 * @domain analytics
 * @layer page
 * @related Skeleton, AppLayout
 */

'use client';

import type { ReactNode } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { SkeletonDashboard } from '@/components/ui/Skeleton';

export default function AnalyticsLoading(): ReactNode {
  return (
    <AppLayout>
      <SkeletonDashboard />
    </AppLayout>
  );
}
