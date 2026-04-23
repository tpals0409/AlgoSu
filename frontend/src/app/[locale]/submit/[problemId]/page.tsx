/**
 * @file 리다이렉트: /submit/[problemId] → /problems/[problemId] (i18n 적용)
 * @domain submission
 * @layer page
 * @related problems/[id]/page.tsx, messages/problems.json
 * @deprecated 통합 페이지로 이동됨
 */

import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

interface MetadataProps {
  readonly params: Promise<{ locale: string; problemId: string }>;
}

export async function generateMetadata({ params }: MetadataProps): Promise<Metadata> {
  const { locale, problemId } = await params;
  const t = await getTranslations({ locale, namespace: 'problems' });

  return {
    title: t('submit.metaTitle', { problemId }),
    description: t('submit.metaDescription', { problemId }),
  };
}

interface PageProps {
  readonly params: Promise<{ problemId: string }>;
}

export default async function SubmitRedirect({ params }: PageProps) {
  const { problemId } = await params;
  redirect(`/problems/${problemId}`);
}
