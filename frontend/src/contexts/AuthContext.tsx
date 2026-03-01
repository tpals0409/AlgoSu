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
    setUser(null);
  }, []);

  // M1-M2: 토큰 만료 5분 전 자동 갱신
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
      } catch {
        setSessionExpired(true);
      }
    }, refreshIn);

    return () => clearTimeout(timer);
  }, [user]);

  const value: AuthContextValue = {
    user,
    isLoading,
    isAuthenticated: user !== null,
    githubConnected,
    sessionExpired,
    login,
    logout,
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
