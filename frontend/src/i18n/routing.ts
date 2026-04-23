/**
 * @file i18n 라우팅 설정
 * @domain i18n
 * @layer config
 * @related src/i18n/request.ts, src/middleware.ts, src/app/[locale]/layout.tsx
 *
 * next-intl defineRouting으로 지원 locale 목록과 URL 전략을 확정한다.
 * D2 결정: localePrefix 'as-needed' — 기본 locale(ko)은 prefix 생략, en만 /en/* 명시.
 */

import { defineRouting } from 'next-intl/routing';

/**
 * AlgoSu i18n 라우팅 설정.
 *
 * - locales: 지원 언어 목록 (ko 기본, en 영어)
 * - defaultLocale: 기본 언어 ko — URL prefix 생략
 * - localePrefix: 'as-needed' — 기본 locale은 prefix 없음(/dashboard),
 *   영어만 prefix 추가(/en/dashboard)
 */
export const routing = defineRouting({
  locales: ['ko', 'en'] as const,
  defaultLocale: 'ko',
  localePrefix: 'as-needed',
});

/** 유효한 locale 타입 */
export type AppLocale = (typeof routing.locales)[number];
