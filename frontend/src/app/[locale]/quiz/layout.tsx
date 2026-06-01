/**
 * @file 퀴즈 레이아웃 — locale 분기 메타데이터
 * @domain quiz
 * @layer layout
 * @related quiz/page.tsx, messages/quiz.json
 *
 * getTranslations('quiz')로 meta.title/description을 로케일별로 생성한다.
 */

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';

interface QuizLayoutProps {
  readonly children: ReactNode;
  readonly params: Promise<{ locale: string }>;
}

/**
 * 퀴즈 그룹 메타데이터 — 로케일 분기.
 *
 * /ko/quiz → "CS 퀴즈"
 * /en/quiz → "CS Quiz"
 */
export async function generateMetadata({
  params,
}: QuizLayoutProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'quiz' });

  return {
    title: t('meta.title'),
    description: t('meta.description'),
  };
}

export default function QuizLayout({ children }: QuizLayoutProps): ReactNode {
  return children;
}
