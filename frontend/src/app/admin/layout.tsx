'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';

const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? '')
  .split(',')
  .map((e) => e.trim())
  .filter(Boolean);

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (
      !isAuthenticated ||
      !user?.email ||
      !ADMIN_EMAILS.includes(user.email)
    ) {
      router.replace('/dashboard');
      return;
    }
    setAuthorized(true);
  }, [user, isAuthenticated, isLoading, router]);

  if (!authorized) return null;

  return <AppLayout>{children}</AppLayout>;
}
