'use client';

import type { ReactNode } from 'react';
import { TopNav } from '@/components/layout/TopNav';
import { Alert } from '@/components/ui/Alert';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

interface AppLayoutProps {
  readonly children: ReactNode;
  readonly className?: string;
}

export function AppLayout({ children, className }: AppLayoutProps): ReactNode {
  const { sessionExpired, logout } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopNav />
      {sessionExpired && (
        <div className="mx-auto w-full max-w-screen-xl px-4 pt-4 sm:px-6 lg:px-8">
          <Alert variant="warning" title="세션 만료">
            세션이 만료되었습니다.{' '}
            <button
              type="button"
              onClick={logout}
              className="underline font-medium"
            >
              다시 로그인하기
            </button>
          </Alert>
        </div>
      )}
      <main
        className={cn(
          'mx-auto w-full max-w-screen-xl flex-1 px-4 py-6 sm:px-6 lg:px-8',
          className,
        )}
      >
        {children}
      </main>
      <footer className="border-t border-border py-4 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} AlgoSu. All rights reserved.
      </footer>
    </div>
  );
}
