'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { isAdmin, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated || !isAdmin) {
      router.replace('/dashboard');
      return;
    }
    setAuthorized(true);
  }, [isAdmin, isAuthenticated, isLoading, router]);

  if (!authorized) return null;

  return <AppLayout>{children}</AppLayout>;
}
