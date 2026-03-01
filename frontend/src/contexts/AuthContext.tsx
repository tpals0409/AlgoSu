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
      } else {
        removeToken();
      }
      setIsLoading(false);
    };

    void initAuth();
  }, []);

  const logout = useCallback((): void => {
    removeToken();
    removeRefreshToken();
    setUser(null);
  }, []);

  const value: AuthContextValue = {
    user,
    isLoading,
    isAuthenticated: user !== null,
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
