'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';

export function HeroButtons(): ReactNode {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex h-[44px] gap-3" aria-hidden />;
  }

  if (isAuthenticated) {
    return (
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Button asChild size="lg" variant="primary">
          <Link href="/problems">문제 풀기</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/dashboard">내 대시보드</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex justify-center">
      <Button asChild size="lg" variant="primary">
        <Link href="/login">시작하기</Link>
      </Button>
    </div>
  );
}
