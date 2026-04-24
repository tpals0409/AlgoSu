/**
 * @file Admin 서버사이드 권한 검증 유틸
 * @domain identity
 * @layer lib/server
 * @related admin/layout.tsx, gateway /auth/profile
 *
 * Server Component 전용. Gateway /auth/profile 내부 호출로
 * isAdmin 여부를 검증하고, 비admin 요청은 redirect 처리한다.
 * 번들에 admin UI가 노출되지 않도록 서버에서 차단.
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

/** Gateway /auth/profile 응답 중 admin 검증에 필요한 최소 필드 */
interface ProfileResponse {
  isAdmin: boolean;
}

/** 클러스터 내부 Gateway URL (k3s DNS 기준) */
const GATEWAY_URL =
  process.env['GATEWAY_INTERNAL_URL'] ?? 'http://localhost:3000';

/**
 * locale-aware redirect 경로를 생성한다.
 * 기본 locale(ko)은 prefix 생략, 그 외는 /{locale}{path} 형식.
 */
function localePath(locale: string, path: string): string {
  return locale === 'ko' ? path : `/${locale}${path}`;
}

/**
 * Admin 권한을 서버사이드에서 검증한다.
 * 비인증/비admin 사용자는 적절한 페이지로 redirect 처리.
 *
 * - 토큰 없음 → /login
 * - 프로필 조회 실패 → /login (토큰 만료/무효)
 * - isAdmin false → /dashboard
 * - 네트워크/파싱 에러 → /dashboard (fail-secure)
 *
 * @param locale - 현재 요청의 locale (redirect 경로 결정용)
 * @throws redirect — Next.js 서버 redirect (NEXT_REDIRECT)
 */
export async function requireAdmin(locale: string): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get('token');

  if (!token) {
    redirect(localePath(locale, '/login'));
  }

  // redirect()는 내부적으로 throw하므로, try/catch 밖에서 호출
  let authenticated = false;
  let profile: ProfileResponse | null = null;

  try {
    const res = await fetch(`${GATEWAY_URL}/auth/profile`, {
      headers: { cookie: `token=${token.value}` },
      cache: 'no-store',
    });

    authenticated = res.ok;

    if (res.ok) {
      profile = (await res.json()) as ProfileResponse;
    }
  } catch {
    // fail-secure: 네트워크/파싱 에러는 미인증으로 처리
  }

  if (!authenticated) {
    redirect(localePath(locale, '/login'));
  }

  if (!profile?.isAdmin) {
    redirect(localePath(locale, '/dashboard'));
  }
}
