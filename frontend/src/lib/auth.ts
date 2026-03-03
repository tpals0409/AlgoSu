/**
 * @file JWT 토큰 저장/조회/삭제 유틸리티
 * @domain auth
 * @layer lib
 * @related AuthContext, api.ts
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
 * M17: JWT 토큰 만료 여부 확인
 * exp 클레임이 현재 시간보다 과거이면 true
 */
export function isTokenExpired(token?: string | null): boolean {
  const t = token ?? getToken();
  if (!t) return true;
  const payload = decodeTokenPayload(t);
  if (!payload) return true;
  const exp = payload['exp'];
  if (typeof exp !== 'number') return true;
  // 만료 10초 전부터 만료 처리 (네트워크 지연 대비)
  return Date.now() >= (exp - 10) * 1000;
}

/**
 * 토큰 만료까지 남은 시간(ms) 반환. 만료됨/파싱 불가 시 0.
 */
export function getTokenTtlMs(token?: string | null): number {
  const t = token ?? getToken();
  if (!t) return 0;
  const payload = decodeTokenPayload(t);
  if (!payload) return 0;
  const exp = payload['exp'];
  if (typeof exp !== 'number') return 0;
  const remaining = exp * 1000 - Date.now();
  return remaining > 0 ? remaining : 0;
}

export const REFRESH_TOKEN_KEY = 'algosu:refresh_token' as const;

export function setRefreshToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function removeRefreshToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(REFRESH_TOKEN_KEY);
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
