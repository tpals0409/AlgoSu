/**
 * @file 퀴즈 라우트 Suspense 폴백
 * @domain quiz
 * @layer page
 * @related Skeleton, AppLayout
 */

'use client';

import type { ReactNode } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { SkeletonCard } from '@/components/ui/Skeleton';

export default function QuizLoading(): ReactNode {
  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-xl">
        <SkeletonCard />
      </div>
    </AppLayout>
  );
}
