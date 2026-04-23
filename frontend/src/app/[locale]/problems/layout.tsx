/**
 * @file 문제 목록 레이아웃 — locale 분기 메타데이터
 * @domain problem
 * @layer layout
 * @related problems/page.tsx, messages/problems.json
 *
 * getTranslations('problems')로 meta 키를 사용한다.
 */

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';

interface ProblemsLayoutProps {
  readonly children: ReactNode;
  readonly params: Promise<{ locale: string }>;
}

/**
 * Problems 그룹 메타데이터 — 로케일 분기.
 *
 * /ko/problems → "문제 목록"
 * /en/problems → "Problems"
 */
export async function generateMetadata({
  params,
}: ProblemsLayoutProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'problems' });

  return {
    title: t('meta.title'),
    description: t('meta.description'),
  };
}

export default function ProblemsLayout({ children }: ProblemsLayoutProps): ReactNode {
  return children;
}
