/**
 * @file 프로필 페이지 라우트 Suspense 폴백
 * @domain identity
 * @layer page
 * @related Skeleton, AppLayout
 */

'use client';

import type { ReactNode } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { SkeletonProfile } from '@/components/ui/Skeleton';

export default function ProfileLoading(): ReactNode {
  return (
    <AppLayout>
      <SkeletonProfile />
    </AppLayout>
  );
}
