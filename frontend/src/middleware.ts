/**
 * @file Next.js Edge Middleware — locale 감지 + 인증 가드 체이닝
 * @domain i18n
 * @layer middleware
 * @related src/i18n/routing.ts, src/i18n/request.ts
 *
 * 실행 순서:
 *   1. DEV_MOCK 바이패스 (개발 환경 전용)
 *   2. 인증 가드 — locale-stripped 경로 기준으로 PUBLIC_PATHS 판별
 *      - 미인증 + protected → /login (locale-aware) redirect
 *      - 인증됨 + /login  → /dashboard (locale-aware) redirect
 *   3. next-intl createMiddleware — locale 감지/rewrite 처리
 *
 * D4 감지 순서: URL prefix → 쿠키(NEXT_LOCALE) → Accept-Language → 기본 ko
 * D2 전략: localePrefix 'as-needed' — ko는 prefix 생략, en은 /en/* 명시
 */

import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from '@/i18n/routing';

// ── i18n 미들웨어 인스턴스 ────────────────────────────────────────────────
const intlMiddleware = createMiddleware(routing);

// ── 인증 없이 접근 가능한 경로 (locale prefix 제거 후 기준) ─────────────────
const PUBLIC_PATHS = [
  '/',
  '/login',
  '/callback',
  '/guest',
  '/shared',
  '/privacy',
  '/terms',
] as const;

/** @sync src/lib/locale-path.ts#stripLocalePrefix — Edge Runtime 전용, 로직 동일 */
/**
 * URL에서 non-default locale prefix를 제거한 순수 경로 반환.
 * ko(기본)는 prefix가 없으므로 그대로 반환.
 * en은 /en/... → /... 으로 변환.
 */
function stripLocalePath(pathname: string): string {
  for (const locale of routing.locales) {
    if (locale === routing.defaultLocale) continue;
    if (pathname === `/${locale}`) return '/';
    if (pathname.startsWith(`/${locale}/`)) {
      return pathname.slice(`/${locale}`.length);
    }
  }
  return pathname;
}

/**
 * URL에 명시된 non-default locale prefix 반환.
 * 기본 locale(ko)이거나 prefix 없으면 null.
 */
function getExplicitLocale(pathname: string): string | null {
  for (const locale of routing.locales) {
    if (locale === routing.defaultLocale) continue;
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) {
      return locale;
    }
  }
  return null;
}

/** locale-stripped 경로가 Public인지 확인 */
function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/** redirect 파라미터의 Open Redirect 공격 방지 검증 */
function sanitizeRedirect(redirect: string): string {
  if (!redirect.startsWith('/') || redirect.includes('//')) {
    return '/dashboard';
  }
  return redirect;
}

export function middleware(request: NextRequest): NextResponse {
  // ── DEV MOCK: 개발 환경에서만 인증 체크 바이패스 ────────────────────────
  if (
    process.env.NEXT_PUBLIC_DEV_MOCK === 'true' &&
    process.env.NODE_ENV !== 'production'
  ) {
    return intlMiddleware(request);
  }
  // ──────────────────────────────────────────────────────────────────────────

  const { pathname } = request.nextUrl;
  const strippedPath = stripLocalePath(pathname);
  const explicitLocale = getExplicitLocale(pathname);
  const hasToken = request.cookies.has('token');

  // ── 미인증 + Protected 경로 → /login?redirect=원래경로 (locale-aware) ──
  if (!hasToken && !isPublicPath(strippedPath)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = explicitLocale ? `/${explicitLocale}/login` : '/login';
    loginUrl.searchParams.set('redirect', encodeURIComponent(strippedPath));
    return NextResponse.redirect(loginUrl);
  }

  // ── 인증 완료 + /login 접근 → /dashboard (locale-aware) ─────────────────
  if (hasToken && strippedPath === '/login') {
    const redirect = request.nextUrl.searchParams.get('redirect');
    const target = request.nextUrl.clone();
    const redirectPath = redirect
      ? sanitizeRedirect(decodeURIComponent(redirect))
      : '/dashboard';
    target.pathname = explicitLocale
      ? `/${explicitLocale}${redirectPath}`
      : redirectPath;
    target.search = '';
    return NextResponse.redirect(target);
  }

  // ── next-intl locale 감지/rewrite ────────────────────────────────────────
  return intlMiddleware(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|ads\\.txt|robots\\.txt|sitemap\\.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
