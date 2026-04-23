/**
 * @file 제출 상세 레이아웃 — locale 분기 메타데이터
 * @domain submission
 * @layer layout
 * @related submissions/[id]/status/page.tsx, submissions/[id]/analysis/page.tsx, messages/submissions.json
 *
 * getTranslations('submissions')로 detail.meta* 키를 사용한다.
 */

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';

interface LayoutProps {
  readonly children: ReactNode;
  readonly params: Promise<{ locale: string; id: string }>;
}

/**
 * Submission Detail 메타데이터 — 로케일 분기.
 *
 * /ko/submissions/abc → "제출 #abc"
 * /en/submissions/abc → "Submission #abc"
 */
export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: 'submissions' });

  return {
    title: t('detail.metaTitle', { id }),
    description: t('detail.metaDescription', { id }),
  };
}

export default function SubmissionDetailLayout({ children }: LayoutProps): ReactNode {
  return children;
}
