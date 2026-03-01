'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

/**
 * 인증 필수 페이지 가드 훅
 *
 * - 로딩 중이면 아무 동작 안 함
 * - 미인증이면 /login으로 리다이렉트
 * - isReady=true일 때 안전하게 렌더링 가능
 */
export function useRequireAuth(): { isReady: boolean; isAuthenticated: boolean } {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  return { isReady: !isLoading && isAuthenticated, isAuthenticated };
}
