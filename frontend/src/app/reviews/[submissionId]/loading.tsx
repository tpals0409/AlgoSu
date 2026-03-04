/**
 * @file 코드리뷰 2-패널 라우트 Suspense 폴백
 * @domain review
 * @layer page
 * @related Skeleton, AppLayout
 */

'use client';

import type { ReactNode } from 'react';
import { SkeletonReview } from '@/components/ui/Skeleton';

/** 리뷰 페이지는 Focus Mode가 있어 AppLayout 제외 */
export default function ReviewLoading(): ReactNode {
  return (
    <div className="min-h-screen bg-bg p-4 lg:p-6">
      <SkeletonReview />
    </div>
  );
}
