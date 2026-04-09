/**
 * @file 인증 관련 localStorage 유틸리티
 * @domain auth
 * @layer lib
 * @related AuthContext, api.ts
 *
 * JWT는 httpOnly Cookie로 관리 (서버 측 설정/삭제).
 * 이 모듈은 로그아웃 시 레거시 localStorage 정리 + GitHub 연동 상태 캐시만 담당.
 */

// ── 레거시 토큰 정리 (로그아웃 시 localStorage 잔재 제거) ──

const TOKEN_KEY = 'algosu:token' as const;
const REFRESH_TOKEN_KEY = 'algosu:refresh_token' as const;

/** 레거시 localStorage 토큰 삭제 (로그아웃 시 호출) */
export function removeToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
}

/** 레거시 localStorage 리프레시 토큰 삭제 (로그아웃 시 호출) */
export function removeRefreshToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

// ── GitHub 연동 상태 (localStorage 캐시) ──

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
