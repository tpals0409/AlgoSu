/**
 * @file 언어 스위처 — 로케일 전환 버튼 (ko/en)
 * @domain common
 * @layer component
 * @related i18n/navigation, AppLayout, TopNav
 *
 * 현재 locale을 감지하고 ko/en 토글 UI를 제공한다.
 * 선택 시 next-intl locale-aware router로 경로를 전환하고
 * NEXT_LOCALE 쿠키를 365일 유효기간으로 갱신한다.
 * Glassmorphism 스타일로 TopNav/AppLayout와 시각적 일관성 유지.
 * useSearchParams로 쿼리 파라미터를 보존하여 locale 전환 시 손실 방지.
 */

'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import type { AppLocale } from '@/i18n/routing';

/** 지원 로케일 목록 */
const LOCALES: readonly { readonly code: AppLocale; readonly label: string }[] = [
  { code: 'ko', label: 'KO' },
  { code: 'en', label: 'EN' },
];

/** NEXT_LOCALE 쿠키 유효 기간 (365일, 초 단위) */
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

/**
 * 언어 스위처 컴포넌트.
 *
 * - useLocale()로 현재 활성 로케일 감지
 * - 클릭 시 NEXT_LOCALE 쿠키 갱신 + locale-aware router.replace 호출
 * - radiogroup 패턴으로 접근성 준수 (aria-checked, aria-current)
 */
export function LanguageSwitcher(): ReactNode {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations('common');

  /** 로케일 전환 핸들러 — 쿼리 파라미터 보존 */
  const handleLocaleChange = useCallback(
    (nextLocale: AppLocale) => {
      if (nextLocale === locale) return;

      // NEXT_LOCALE 쿠키 갱신 (365일, SameSite=Lax)
      document.cookie = `NEXT_LOCALE=${nextLocale};path=/;max-age=${COOKIE_MAX_AGE};SameSite=Lax`;

      // 쿼리 파라미터 보존하여 locale-aware 라우터로 경로 전환
      const search = searchParams.toString();
      const target = search ? `${pathname}?${search}` : pathname;
      router.replace(target, { locale: nextLocale });
    },
    [locale, router, pathname, searchParams],
  );

  return (
    <div
      className="flex items-center gap-0.5 rounded-badge border border-border bg-bg-alt/50 p-0.5 backdrop-blur-sm"
      role="radiogroup"
      aria-label={t('language.switcher')}
    >
      {LOCALES.map(({ code, label }) => {
        const isActive = code === locale;
        return (
          <button
            key={code}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-current={isActive ? 'true' : undefined}
            aria-label={t(`language.${code}`)}
            onClick={() => handleLocaleChange(code)}
            className={cn(
              'px-2 py-0.5 text-[11px] font-medium transition-all duration-150 rounded-[4px]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              isActive
                ? 'bg-primary text-white shadow-sm'
                : 'text-text-3 hover:text-text',
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
