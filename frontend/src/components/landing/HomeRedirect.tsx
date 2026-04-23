/**
 * @file Authenticated user dashboard redirect
 * @domain common
 * @layer component
 * @related AuthContext, StudyContext
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Redirects authenticated users to /studies
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
