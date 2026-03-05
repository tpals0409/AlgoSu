/**
 * @file 인증 유저 대시보드 리다이렉트
 * @domain common
 * @layer component
 * @related AuthContext, StudyContext
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

/**
 * 인증된 유저를 /studies로 리다이렉트
 * @domain common
 */
export function HomeRedirect(): null {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated) {
      router.replace('/studies');
    }
  }, [isAuthenticated, isLoading, router]);

  return null;
}
