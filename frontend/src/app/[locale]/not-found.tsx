/**
 * @file 404 Not Found 페이지 — 국제화 대응 (Server Component)
 * @domain common
 * @layer page
 * @related errors.json, Logo, i18n/routing
 *
 * getTranslations('errors')로 notFound 키를 참조하여
 * 로케일별 404 페이지를 렌더링한다.
 *
 * Server Component 이유: app/[locale]/layout.tsx가 invalid locale 시
 * NextIntlClientProvider 렌더링 전에 notFound()를 호출하므로
 * useTranslations는 throw → 500 에러 발생. defaultLocale 폴백으로 안전 처리.
 */

import type { ReactNode } from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { Logo } from '@/components/ui/Logo';

/**
 * 404 Not Found 페이지 (Server Component).
 *
 * - Logo + 404 타이틀 + 설명 + 홈 링크
 * - errors.notFound 번역 키 사용
 * - invalid locale 안전: defaultLocale 폴백
 */
export default async function NotFound(): Promise<ReactNode> {
  const t = await getTranslations({
    locale: routing.defaultLocale,
    namespace: 'errors',
  });

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-4">
      <Logo size={48} className="mb-6" />
      <h1 className="text-7xl font-bold text-primary">{t('notFound.title')}</h1>
      <p className="mt-4 text-sm text-text-3">
        {t('notFound.description')}
      </p>
      <Link
        href="/"
        className="mt-6 rounded-btn bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:brightness-110"
      >
        {t('notFound.home')}
      </Link>
    </div>
  );
}
