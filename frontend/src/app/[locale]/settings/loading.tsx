/**
 * @file 설정 페이지 라우트 Suspense 폴백
 * @domain settings
 * @layer page
 * @related Skeleton, AppLayout
 */

'use client';

import type { ReactNode } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { SkeletonListPage } from '@/components/ui/Skeleton';

export default function SettingsLoading(): ReactNode {
  return (
    <AppLayout>
      <div className="space-y-6" aria-busy="true" aria-label="설정 로딩 중">
        <SkeletonListPage rows={4} />
      </div>
    </AppLayout>
  );
}
