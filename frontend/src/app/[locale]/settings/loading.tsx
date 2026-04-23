/**
 * @file 설정 페이지 라우트 Suspense 폴백
 * @domain settings
 * @layer page
 * @related Skeleton, AppLayout
 */

import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { AppLayout } from '@/components/layout/AppLayout';
import { SkeletonListPage } from '@/components/ui/Skeleton';

export default async function SettingsLoading(): Promise<ReactNode> {
  const t = await getTranslations('account');

  return (
    <AppLayout>
      <div className="space-y-6" aria-busy="true" aria-label={t('settings.loading')}>
        <SkeletonListPage rows={4} />
      </div>
    </AppLayout>
  );
}
