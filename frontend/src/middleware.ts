import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * AlgoSu 라우팅 가드 미들웨어
 *
 * - 미인증 → /login 리다이렉트
 * - 공개 경로: /login, /callback, /github-link
 *
 * NOTE: github_connected, 스터디 선택 가드는 클라이언트 페이지 레벨에서 수행.
 * 미들웨어에서는 httpOnly cookie 토큰 여부만 확인 가능.
 * localStorage 기반 토큰이라 쿠키 접근 불가 → 클라이언트 가드로 처리.
 */

const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/callback',
  '/github-link',
];

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // 공개 경로는 통과
  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(path + '/'),
  );
  if (isPublic) return NextResponse.next();

  // Next.js 내부 경로 / 정적 에셋 통과
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // localStorage 기반 인증이라 미들웨어에서 토큰 확인 불가
  // 실제 인증 가드는 AuthContext + 클라이언트 useEffect에서 처리
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
