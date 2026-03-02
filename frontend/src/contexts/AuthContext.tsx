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
  getToken,
  setToken,
  removeToken,
  isTokenExpired,
  getRefreshToken,
  removeRefreshToken,
  getCurrentUserEmail,
  getGitHubConnected,
  setGitHubConnected as setGitHubConnectedStorage,
  setGitHubUsername as setGitHubUsernameStorage,
  getTokenTtlMs,
} from '@/lib/auth';
import { authApi } from '@/lib/api';

// ── 타입 ──

interface AuthUser {
  email: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  githubConnected: boolean;
  sessionExpired: boolean;
  login: (token: string) => void;
  logout: () => void;
  updateGitHubStatus: (connected: boolean, username?: string | null) => void;
}

// ── 컨텍스트 ──

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Provider ──

interface AuthProviderProps {
  readonly children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps): ReactNode {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [githubConnected, setGithubConnected] = useState<boolean>(false);
  const [sessionExpired, setSessionExpired] = useState<boolean>(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number>(0);

  // M17: 초기 마운트 시 토큰 만료 확인 + 자동 refresh
  useEffect(() => {
    const initAuth = async (): Promise<void> => {
      const token = getToken();

      if (!token) {
        setIsLoading(false);
        return;
      }

      // 토큰 만료 확인
      if (isTokenExpired(token)) {
        const refreshToken = getRefreshToken();
        if (refreshToken) {
          try {
            const { access_token } = await authApi.refresh();
            setToken(access_token);
            const email = getCurrentUserEmail();
            if (email) {
              setUser({ email });
              setGithubConnected(getGitHubConnected());
            }
          } catch {
            // Refresh 실패 → 로그아웃
            removeToken();
            removeRefreshToken();
          }
        } else {
          // Refresh Token 없음 → 만료된 토큰 제거
          removeToken();
        }
        setIsLoading(false);
        return;
      }

      // 토큰 유효 → 사용자 정보 복원
      const email = getCurrentUserEmail();
      if (email) {
        setUser({ email });
        setGithubConnected(getGitHubConnected());
      } else {
        removeToken();
      }
      setIsLoading(false);
    };

    void initAuth();
  }, []);

  const login = useCallback((token: string): void => {
    setToken(token);
    const email = getCurrentUserEmail();
    if (email) {
      setUser({ email });
      setGithubConnected(getGitHubConnected());
      setSessionExpired(false);
    }
  }, []);

  const logout = useCallback((): void => {
    removeToken();
    removeRefreshToken();
    setGitHubConnectedStorage(false);
    setGitHubUsernameStorage(null);
    setUser(null);
    setGithubConnected(false);
    setSessionExpired(false);
    window.location.href = '/login';
  }, []);

  // GitHub 연동 상태 업데이트 (단일 진실 원천)
  const updateGitHubStatus = useCallback((connected: boolean, username?: string | null): void => {
    setGitHubConnectedStorage(connected);
    setGitHubUsernameStorage(username ?? null);
    setGithubConnected(connected);
  }, []);

  // M1-M2: 토큰 만료 5분 전 자동 갱신 (lastRefreshedAt로 재스케줄링)
  useEffect(() => {
    if (!user) return;
    const ttl = getTokenTtlMs();
    if (ttl <= 0) return;

    // 만료 5분 전에 갱신, 최소 10초 후
    const refreshIn = Math.max(ttl - 5 * 60 * 1000, 10_000);

    const timer = setTimeout(async () => {
      try {
        const { access_token } = await authApi.refresh();
        setToken(access_token);
        setSessionExpired(false);
        setLastRefreshedAt(Date.now());
      } catch {
        setSessionExpired(true);
      }
    }, refreshIn);

    return () => clearTimeout(timer);
  }, [user, lastRefreshedAt]);

  // 활동 기반 세션 갱신: 사용자 활동 시 TTL이 절반 이하면 즉시 갱신
  useEffect(() => {
    if (!user) return;
    let refreshing = false;

    const handleActivity = async () => {
      if (refreshing || sessionExpired) return;
      const ttl = getTokenTtlMs();
      const token = getToken();
      if (!token || ttl <= 0) return;

      // JWT 전체 유효시간 계산 (exp - iat)
      const payload = JSON.parse(atob(token.split('.')[1])) as { exp?: number; iat?: number };
      const totalTtl = ((payload.exp ?? 0) - (payload.iat ?? 0)) * 1000;
      if (totalTtl <= 0) return;

      // 남은 시간이 전체의 절반 이하일 때만 갱신
      if (ttl > totalTtl / 2) return;

      refreshing = true;
      try {
        const { access_token } = await authApi.refresh();
        setToken(access_token);
        setSessionExpired(false);
        setLastRefreshedAt(Date.now());
      } catch {
        setSessionExpired(true);
      } finally {
        refreshing = false;
      }
    };

    // 쓰로틀: 이벤트가 많아도 60초에 1번만 체크
    let lastCheck = 0;
    const throttledActivity = () => {
      const now = Date.now();
      if (now - lastCheck < 60_000) return;
      lastCheck = now;
      void handleActivity();
    };

    window.addEventListener('click', throttledActivity);
    window.addEventListener('keydown', throttledActivity);
    window.addEventListener('scroll', throttledActivity);

    return () => {
      window.removeEventListener('click', throttledActivity);
      window.removeEventListener('keydown', throttledActivity);
      window.removeEventListener('scroll', throttledActivity);
    };
  }, [user, sessionExpired]);

  const value: AuthContextValue = {
    user,
    isLoading,
    isAuthenticated: user !== null,
    githubConnected,
    sessionExpired,
    login,
    logout,
    updateGitHubStatus,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ── Hook ──

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth는 AuthProvider 내부에서만 사용할 수 있습니다.');
  }
  return ctx;
}
