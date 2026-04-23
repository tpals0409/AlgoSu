/**
 * @file Auth API + Settings API
 * @domain auth
 * @layer api
 * @related AuthContext, GatewayAuthGuard
 */

import { fetchApi } from './client';
import type { AuthResponse, OAuthUrlResponse } from './types';

export const authApi = {
  // C1: email/password register/login 제거 (소셜로그인 전용 정책)

  /** 데모 로그인 — 데모 계정으로 JWT 발급 */
  demoLogin: (): Promise<{ redirect: string }> =>
    fetchApi('/auth/demo', { method: 'POST' }),

  /** OAuth 로그인 URL 조회 — provider: google | naver | kakao */
  getOAuthUrl: (provider: 'google' | 'naver' | 'kakao'): Promise<OAuthUrlResponse> =>
    fetchApi(`/auth/oauth/${provider}`),

  /** GitHub 계정 연동 URL 조회 */
  linkGitHub: (): Promise<OAuthUrlResponse> =>
    fetchApi('/auth/github/link', { method: 'POST' }),

  /** GitHub 연동 해제 */
  unlinkGitHub: (): Promise<{ message: string }> =>
    fetchApi('/auth/github/link', { method: 'DELETE' }),

  /** GitHub 재연동 URL 조회 */
  relinkGitHub: (): Promise<OAuthUrlResponse> =>
    fetchApi('/auth/github/relink', { method: 'POST' }),

  /** 액세스 토큰 갱신 */
  refresh: (): Promise<AuthResponse> =>
    fetchApi('/auth/refresh', { method: 'POST' }),

  /** 프로필 조회 */
  getProfile: (): Promise<{ id: string; email: string; name: string | null; avatar_url: string | null; oauth_provider: string | null; github_connected: boolean; github_username: string | null; created_at: string; isAdmin: boolean }> =>
    fetchApi('/auth/profile'),

  /** 프로필 수정 (아바타) */
  updateProfile: (data: { avatar_url?: string }): Promise<{ avatar_url: string | null }> =>
    fetchApi('/auth/profile', { method: 'PATCH', body: JSON.stringify(data) }),

  /** 계정 삭제 (소프트 딜리트) */
  deleteAccount: (): Promise<{ message: string }> =>
    fetchApi('/auth/account', { method: 'DELETE' }),
};

// ── Settings API (인증 필수) ──

export interface ProfileSettings {
  profileSlug: string | null;
  isProfilePublic: boolean;
}

export const settingsApi = {
  /** 프로필 설정 조회 */
  getProfile: (): Promise<ProfileSettings> =>
    fetchApi('/api/users/me/settings'),

  /** 프로필 설정 업데이트 */
  updateProfile: (data: { profileSlug?: string; isProfilePublic?: boolean }): Promise<ProfileSettings> =>
    fetchApi('/api/users/me/settings/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};
