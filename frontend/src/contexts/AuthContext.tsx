'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { getToken, setToken, removeToken, getCurrentUserEmail } from '@/lib/auth';
import { authApi } from '@/lib/api';

// ── 타입 ──

interface AuthUser {
  email: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, username: string) => Promise<void>;
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

  // 초기 마운트 시 토큰에서 사용자 정보 복원
  useEffect(() => {
    const token = getToken();
    if (token) {
      const email = getCurrentUserEmail();
      if (email) {
        setUser({ email });
      } else {
        // 유효하지 않은 토큰 제거
        removeToken();
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<void> => {
    const { access_token } = await authApi.login({ email, password });
    setToken(access_token);
    setUser({ email });
  }, []);

  const register = useCallback(
    async (email: string, password: string, username: string): Promise<void> => {
      const { access_token } = await authApi.register({ email, password, username });
      setToken(access_token);
      setUser({ email });
    },
    [],
  );

  const logout = useCallback((): void => {
    removeToken();
    setUser(null);
  }, []);

  const value: AuthContextValue = {
    user,
    isLoading,
    isAuthenticated: user !== null,
    login,
    register,
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
