/**
 * @file 제출 목록 레이아웃 — locale 분기 메타데이터
 * @domain submission
 * @layer layout
 * @related submissions/page.tsx, messages/submissions.json
 *
 * getTranslations('submissions')로 meta 키를 사용한다.
 */

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';

interface SubmissionsLayoutProps {
  readonly children: ReactNode;
  readonly params: Promise<{ locale: string }>;
}

/**
 * Submissions 그룹 메타데이터 — 로케일 분기.
 *
 * /ko/submissions → "제출 목록"
 * /en/submissions → "Submissions"
 */
export async function generateMetadata({
  params,
}: SubmissionsLayoutProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'submissions' });

  return {
    title: t('meta.title'),
    description: t('meta.description'),
  };
}

export default function SubmissionsLayout({ children }: SubmissionsLayoutProps): ReactNode {
  return children;
}
