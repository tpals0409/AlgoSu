/**
 * @file 스터디 404 Not Found 페이지 — 국제화 대응 (Server Component)
 * @domain study
 * @layer page
 * @related errors.json, Logo, i18n/routing
 *
 * getTranslations('errors')로 studyNotFound 키를 참조하여
 * 로케일별 스터디 404 페이지를 렌더링한다.
 */

import type { ReactNode } from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { Logo } from '@/components/ui/Logo';

/**
 * 스터디 404 Not Found 페이지 (Server Component).
 *
 * - Logo + 404 타이틀 + 설명 + 스터디 목록 링크
 * - errors.studyNotFound 번역 키 사용
 * - defaultLocale 폴백으로 안전 처리
 */
export default async function StudyNotFound(): Promise<ReactNode> {
  const t = await getTranslations({
    locale: routing.defaultLocale,
    namespace: 'errors',
  });

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-4">
      <Logo size={48} className="mb-6" />
      <h1 className="text-7xl font-bold text-primary">404</h1>
      <p className="mt-4 text-sm text-text-3">
        {t('studyNotFound.title')}
      </p>
      <Link
        href="/studies"
        className="mt-6 rounded-btn bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:brightness-110"
      >
        {t('studyNotFound.cta')}
      </Link>
    </div>
  );
}
