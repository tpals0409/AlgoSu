/**
 * @file Dashboard 레이아웃 — locale 분기 메타데이터
 * @domain dashboard
 * @layer layout
 * @related dashboard/page.tsx, messages/dashboard.json
 *
 * getTranslations('dashboard')로 meta.title/description을 로케일별로 생성한다.
 */

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';

interface DashboardLayoutProps {
  readonly children: ReactNode;
  readonly params: Promise<{ locale: string }>;
}

/**
 * Dashboard 그룹 메타데이터 — 로케일 분기.
 *
 * /ko/dashboard → "대시보드"
 * /en/dashboard → "Dashboard"
 */
export async function generateMetadata({
  params,
}: DashboardLayoutProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'dashboard' });

  return {
    title: t('meta.title'),
    description: t('meta.description'),
  };
}

export default function DashboardLayout({ children }: DashboardLayoutProps): ReactNode {
  return children;
}
