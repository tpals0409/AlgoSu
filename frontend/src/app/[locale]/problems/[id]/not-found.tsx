/**
 * @file 문제 404 Not Found 페이지 — 국제화 대응 (Server Component)
 * @domain problem
 * @layer page
 * @related errors.json, Logo
 *
 * getTranslations('errors')로 problemNotFound 키를 참조하여
 * 로케일별 문제 404 페이지를 렌더링한다.
 */

import type { ReactNode } from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Logo } from '@/components/ui/Logo';

/**
 * 문제 404 Not Found 페이지 (Server Component).
 *
 * - Logo + 404 타이틀 + 설명 + 문제 목록 링크
 * - errors.problemNotFound 번역 키 사용
 * - locale: request.ts getRequestConfig 자동 적용
 */
export default async function ProblemNotFound(): Promise<ReactNode> {
  const t = await getTranslations({ namespace: 'errors' });

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-4">
      <Logo size={48} className="mb-6" />
      <h1 className="text-7xl font-bold text-primary">{t('problemNotFound.code')}</h1>
      <p className="mt-4 text-sm text-text-3">
        {t('problemNotFound.title')}
      </p>
      <p className="mt-2 text-xs text-text-3">
        {t('problemNotFound.description')}
      </p>
      <Link
        href="/problems"
        className="mt-6 rounded-btn bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:brightness-110"
      >
        {t('problemNotFound.cta')}
      </Link>
    </div>
  );
}
