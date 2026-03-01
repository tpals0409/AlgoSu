'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useStudy } from '@/contexts/StudyContext';

export function HomeRedirect(): null {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { currentStudyId } = useStudy();

  useEffect(() => {
    if (authLoading) return;
    if (isAuthenticated && currentStudyId) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, currentStudyId, authLoading, router]);

  return null;
}
