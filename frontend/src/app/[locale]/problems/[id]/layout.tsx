/**
 * @file 문제 상세 레이아웃 — locale 분기 메타데이터
 * @domain problem
 * @layer layout
 * @related problems/[id]/page.tsx, messages/problems.json
 *
 * getTranslations('problems')로 detail 키를 사용한다.
 */

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';

interface ProblemDetailLayoutProps {
  readonly children: ReactNode;
  readonly params: Promise<{ locale: string; id: string }>;
}

/**
 * 문제 상세 메타데이터 — 로케일 분기.
 */
export async function generateMetadata({
  params,
}: ProblemDetailLayoutProps): Promise<Metadata> {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: 'problems' });

  return {
    title: t('submit.metaTitle', { problemId: id }),
    description: t('submit.metaDescription', { problemId: id }),
  };
}

export default function ProblemDetailLayout({ children }: ProblemDetailLayoutProps): ReactNode {
  return children;
}
