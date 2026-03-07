/**
 * @file 인증 컨텍스트 — httpOnly Cookie 기반 JWT 인증
 * @domain identity
 * @layer context
 * @related OAuthController, JwtMiddleware, api.ts
 *
 * JWT는 httpOnly Cookie에 저장되어 클라이언트에서 직접 접근 불가.
 * 인증 상태는 서버 API(/auth/profile) 호출로 확인.
 * 토큰 자동 갱신은 서버 TokenRefreshInterceptor가 처리.
 */

'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import {
  getGitHubConnected,
  setGitHubConnected as setGitHubConnectedStorage,
  setGitHubUsername as setGitHubUsernameStorage,
} from '@/lib/auth';
import { authApi } from '@/lib/api';
import { getAvatarPresetKey } from '@/lib/avatars';

// ── TYPES ────────────────────────────────

interface AuthUser {
  id: string;
  email: string;
  avatarPreset: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  githubConnected: boolean;
  sessionExpired: boolean;
  /** OAuth 콜백 후 호출 — Cookie에 토큰이 이미 설정된 상태에서 프로필 로드 */
  loginFromCookie: () => void;
  logout: () => void;
  updateGitHubStatus: (connected: boolean, username?: string | null) => void;
  updateAvatar: (presetKey: string) => Promise<void>;
}

// ── CONSTANTS ────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ── PROVIDER ─────────────────────────────

interface AuthProviderProps {
  readonly children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps): ReactNode {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [githubConnected, setGithubConnected] = useState<boolean>(false);
  const [sessionExpired, setSessionExpired] = useState<boolean>(false);

  /**
   * 초기 마운트 시 서버에 프로필 조회하여 인증 상태 확인.
   * httpOnly Cookie가 있으면 서버가 자동 인증, 없으면 401.
   */
  useEffect(() => {
    const initAuth = async (): Promise<void> => {
      try {
        const profile = await authApi.getProfile();
        setUser({
          id: profile.id,
          email: profile.email,
          avatarPreset: getAvatarPresetKey(profile.avatar_url),
        });
        setGithubConnected(getGitHubConnected());
      } catch {
        // 401 또는 네트워크 에러 → 미인증 상태
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    void initAuth();
  }, []);

  /** OAuth 콜백 후 호출 — 쿠키에 토큰이 이미 있으므로 프로필만 로드 */
  const loginFromCookie = useCallback((): void => {
    setSessionExpired(false);
    authApi.getProfile().then((profile) => {
      setUser({
        id: profile.id,
        email: profile.email,
        avatarPreset: getAvatarPresetKey(profile.avatar_url),
      });
      setGithubConnected(getGitHubConnected());
    }).catch(() => {
      // 프로필 로드 실패 — 일단 기본 상태로 진행 (쿠키가 있으니 페이지 이동 후 재시도)
      setUser({ id: '', email: '', avatarPreset: 'default' });
    });
  }, []);

  /** 로그아웃 — 서버에 Cookie 삭제 요청 후 로컬 상태 초기화 */
  const logout = useCallback((): void => {
    // 서버에 logout 요청 (쿠키 삭제)
    fetch('/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    setGitHubConnectedStorage(false);
    setGitHubUsernameStorage(null);
    setUser(null);
    setGithubConnected(false);
    setSessionExpired(false);
    window.location.href = '/login';
  }, []);

  /** GitHub 연동 상태 업데이트 (단일 진실 원천) */
  const updateGitHubStatus = useCallback((connected: boolean, username?: string | null): void => {
    setGitHubConnectedStorage(connected);
    setGitHubUsernameStorage(username ?? null);
    setGithubConnected(connected);
  }, []);

  /** 프리셋 아바타 변경 */
  const updateAvatar = useCallback(async (presetKey: string): Promise<void> => {
    const avatarUrl = `preset:${presetKey}`;
    await authApi.updateProfile({ avatar_url: avatarUrl });
    setUser((prev) => prev ? { ...prev, avatarPreset: presetKey } : prev);
  }, []);

  const value: AuthContextValue = {
    user,
    isLoading,
    isAuthenticated: user !== null,
    githubConnected,
    sessionExpired,
    loginFromCookie,
    logout,
    updateGitHubStatus,
    updateAvatar,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ── HOOK ──────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth는 AuthProvider 내부에서만 사용할 수 있습니다.');
  }
  return ctx;
}
