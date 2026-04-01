/**
 * @file Next.js Edge Middleware - Route Guard
 * @domain common
 * @layer middleware
 *
 * 2단계 라우트 가드 1단계: 서버 사이드 쿠키 존재 여부 기반 라우트 보호.
 * Public 경로는 인증 없이 접근 가능, Protected 경로는 token 쿠키 필수.
 */

import { NextResponse, type NextRequest } from 'next/server';

/** 인증 없이 접근 가능한 경로 패턴 */
const PUBLIC_PATHS = ['/', '/login', '/callback'];

/** 경로가 Public인지 확인 */
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
  // ── DEV MOCK: 인증 체크 전체 바이패스 ──────────────────────────
  if (process.env.NEXT_PUBLIC_DEV_MOCK === 'true') {
    return NextResponse.next();
  }
  // ────────────────────────────────────────────────────────────────

  const { pathname } = request.nextUrl;
  const hasToken = request.cookies.has('token');

  // 미인증 + Protected 경로 → /login?redirect=원래URL
  if (!hasToken && !isPublicPath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set(
      'redirect',
      encodeURIComponent(pathname),
    );
    return NextResponse.redirect(loginUrl);
  }

  // 인증 완료 + /login 접근 → /dashboard
  if (hasToken && pathname === '/login') {
    const redirect = request.nextUrl.searchParams.get('redirect');
    const target = request.nextUrl.clone();
    target.pathname = redirect
      ? sanitizeRedirect(decodeURIComponent(redirect))
      : '/dashboard';
    target.search = '';
    return NextResponse.redirect(target);
  }

  return NextResponse.next();
}


export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|ads\\.txt|robots\\.txt|sitemap\\.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
