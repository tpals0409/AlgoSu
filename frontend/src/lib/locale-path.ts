/**
 * @file 브라우저 pathname에서 locale prefix를 추출·적용하는 유틸리티
 * @domain i18n
 * @layer util
 * @related i18n/routing.ts, middleware.ts
 */

import { routing } from '@/i18n/routing';

/**
 * pathname 문자열에서 non-default locale prefix를 추출한다.
 * ko(기본 locale)는 prefix가 없으므로 빈 문자열 반환.
 * en은 '/en' 반환.
 */
export function extractLocalePrefix(pathname: string): string {
  for (const locale of routing.locales) {
    if (locale === routing.defaultLocale) continue;
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) {
      return `/${locale}`;
    }
  }
  return '';
}

/**
 * 브라우저 현재 pathname에서 non-default locale prefix를 추출한다.
 * SSR 환경에서는 빈 문자열 반환.
 */
export function getLocalePrefix(): string {
  if (typeof window === 'undefined') return '';
  return extractLocalePrefix(window.location.pathname);
}

/**
 * 경로에 현재 locale prefix를 적용한다.
 * 예: '/login' → '/en/login' (영어 사용자) 또는 '/login' (한국어 사용자)
 */
export function withLocalePrefix(path: string): string {
  return `${getLocalePrefix()}${path}`;
}

/** @sync src/middleware.ts#stripLocalePath — Node/Browser 전용, 로직 동일 */
/**
 * pathname에서 locale prefix를 제거한 순수 경로를 반환한다.
 * middleware.ts의 stripLocalePath와 동일한 로직이지만 클라이언트용.
 */
export function stripLocalePrefix(pathname: string): string {
  for (const locale of routing.locales) {
    if (locale === routing.defaultLocale) continue;
    if (pathname === `/${locale}`) return '/';
    if (pathname.startsWith(`/${locale}/`)) {
      return pathname.slice(`/${locale}`.length);
    }
  }
  return pathname;
}
