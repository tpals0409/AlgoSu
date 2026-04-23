/**
 * @file 국제화 대응 공용 에러 페이지 컴포넌트
 * @domain common
 * @layer component
 * @related errors.json, app/[locale]/error.tsx (전체 에러 바운더리)
 *
 * 모든 error.tsx 바운더리에서 재사용하는 표준 에러 UI.
 * titleKey로 페이지별 번역 키를 지정하고, 해당 키가 없으면
 * generic 폴백으로 자동 전환한다.
 */

'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

interface LocalizedErrorPageProps {
  /** errors 네임스페이스 내 페이지별 키 (예: 'dashboard', 'problems') */
  readonly titleKey: string;
  /** Next.js error boundary reset 콜백 */
  readonly reset: () => void;
  /** 홈으로 돌아가기 링크 표시 여부 (기본: false) */
  readonly includeHomeLink?: boolean;
}

/**
 * 국제화 대응 에러 페이지.
 *
 * - t.has(`{titleKey}.title`) 로 페이지별 키 존재 여부 확인
 * - 키 존재 시 페이지별 title/description 표시
 * - 키 미존재 시 generic.title/description 폴백
 * - retry 버튼은 항상 generic.retry 사용
 * - includeHomeLink=true 시 generic.home 텍스트로 홈 링크 표시
 */
export function LocalizedErrorPage({
  titleKey,
  reset,
  includeHomeLink = false,
}: LocalizedErrorPageProps): ReactNode {
  const t = useTranslations('errors');

  const hasPageKey = t.has(`${titleKey}.title`);
  const title = hasPageKey ? t(`${titleKey}.title`) : t('generic.title');
  const description = hasPageKey
    ? t(`${titleKey}.description`)
    : t('generic.description');

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-4">
      <h1 className="text-4xl font-bold text-text">{title}</h1>
      <p className="mt-4 text-sm text-text-3">{description}</p>
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-btn bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:brightness-110"
        >
          {t('generic.retry')}
        </button>
        {includeHomeLink && (
          <Link
            href="/"
            className="rounded-btn border border-border px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-bg-alt"
          >
            {t('generic.home')}
          </Link>
        )}
      </div>
    </div>
  );
}
