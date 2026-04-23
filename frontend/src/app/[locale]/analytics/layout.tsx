/**
 * @file Analytics 레이아웃 — locale 분기 메타데이터
 * @domain analytics
 * @layer layout
 * @related analytics/page.tsx, messages/dashboard.json (analyticsSection)
 *
 * getTranslations('dashboard')로 analyticsSection.meta 키를 사용한다.
 * dashboard 네임스페이스에 analytics 섹션이 통합되어 있다 (architect D2 결정).
 */

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';

interface AnalyticsLayoutProps {
  readonly children: ReactNode;
  readonly params: Promise<{ locale: string }>;
}

/**
 * Analytics 그룹 메타데이터 — 로케일 분기.
 *
 * /ko/analytics → "학습 분석"
 * /en/analytics → "Learning Analytics"
 */
export async function generateMetadata({
  params,
}: AnalyticsLayoutProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'dashboard' });

  return {
    title: t('analyticsSection.meta.title'),
    description: t('analyticsSection.meta.description'),
  };
}

export default function AnalyticsLayout({ children }: AnalyticsLayoutProps): ReactNode {
  return children;
}
