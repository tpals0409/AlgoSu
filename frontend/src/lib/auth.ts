/**
 * AlgoSu 인증 유틸리티
 *
 * JWT 토큰 저장/조회/삭제
 * localStorage 기반, SSR 안전 처리 포함
 */

export const TOKEN_KEY = 'algosu:token' as const;

/**
 * 토큰 저장
 */
export function setToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
}

/**
 * 토큰 조회 — 없으면 null 반환
 */
export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * 토큰 삭제 (로그아웃)
 */
export function removeToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * 토큰 존재 여부 확인
 */
export function isAuthenticated(): boolean {
  return getToken() !== null;
}

/**
 * JWT payload 디코딩 (서명 검증 없음 — 서버 검증 별도 필수)
 */
export function decodeTokenPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    // base64url → base64
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(base64);
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * 현재 사용자 식별자 추출 (sub 클레임)
 */
export function getCurrentUserId(): string | null {
  const token = getToken();
  if (!token) return null;
  const payload = decodeTokenPayload(token);
  if (!payload) return null;
  return typeof payload['sub'] === 'string' ? payload['sub'] : null;
}

/**
 * 현재 사용자 이메일 추출 (email 클레임)
 */
export function getCurrentUserEmail(): string | null {
  const token = getToken();
  if (!token) return null;
  const payload = decodeTokenPayload(token);
  if (!payload) return null;
  return typeof payload['email'] === 'string' ? payload['email'] : null;
}

/**
 * GitHub 연동 상태 (localStorage 캐시)
 */
const GITHUB_CONNECTED_KEY = 'algosu:github-connected' as const;
const GITHUB_USERNAME_KEY = 'algosu:github-username' as const;

export function getGitHubConnected(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(GITHUB_CONNECTED_KEY) === 'true';
}

export function setGitHubConnected(connected: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(GITHUB_CONNECTED_KEY, String(connected));
}

export function getGitHubUsername(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(GITHUB_USERNAME_KEY);
}

export function setGitHubUsername(username: string | null): void {
  if (typeof window === 'undefined') return;
  if (username) {
    localStorage.setItem(GITHUB_USERNAME_KEY, username);
  } else {
    localStorage.removeItem(GITHUB_USERNAME_KEY);
  }
}

/**
 * 현재 사용자 이름 추출 (name 클레임)
 */
export function getCurrentUserName(): string | null {
  const token = getToken();
  if (!token) return null;
  const payload = decodeTokenPayload(token);
  if (!payload) return null;
  return typeof payload['name'] === 'string' ? payload['name'] : null;
}

/**
 * 현재 사용자 OAuth 제공자 추출
 */
export function getCurrentOAuthProvider(): string | null {
  const token = getToken();
  if (!token) return null;
  const payload = decodeTokenPayload(token);
  if (!payload) return null;
  return typeof payload['oauth_provider'] === 'string' ? payload['oauth_provider'] : null;
}
