/**
 * @file 코드리뷰 상세 레이아웃 — locale 분기 메타데이터
 * @domain review
 * @layer layout
 * @related reviews/[submissionId]/page.tsx, messages/reviews.json
 *
 * getTranslations('reviews')로 meta.* 키를 사용한다.
 */

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';

interface LayoutProps {
  readonly children: ReactNode;
  readonly params: Promise<{ locale: string; submissionId: string }>;
}

/**
 * Review Detail 메타데이터 — 로케일 분기.
 *
 * /ko/reviews/abc → "코드리뷰 #abc"
 * /en/reviews/abc → "Code Review #abc"
 */
export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { locale, submissionId } = await params;
  const t = await getTranslations({ locale, namespace: 'reviews' });

  return {
    title: t('meta.title', { id: submissionId }),
    description: t('meta.description'),
  };
}

export default function ReviewDetailLayout({ children }: LayoutProps): ReactNode {
  return children;
}
