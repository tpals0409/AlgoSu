/**
 * @file 앱 레이아웃 (v2 디자인 시스템)
 * @domain common
 * @layer component
 * @related TopNav, StudySidebar, AuthContext
 *
 * TopNav 항상 상단, StudySidebar는 스터디 페이지에서만 표시.
 * 세션 만료 오버레이 포함.
 */

'use client';

import type { ReactNode } from 'react';
import { Clock } from 'lucide-react';
import { TopNav } from '@/components/layout/TopNav';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

interface AppLayoutProps {
  readonly children: ReactNode;
  readonly className?: string;
}

export function AppLayout({ children, className }: AppLayoutProps): ReactNode {
  const { sessionExpired, logout } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <TopNav />

      {/* 세션 만료 오버레이 */}
      {sessionExpired && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-bg/80 backdrop-blur-sm animate-fade-in">
          <div className="mx-4 flex w-full max-w-xs flex-col items-center gap-5 rounded-card border border-border bg-bg-card p-8 shadow-modal text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft">
              <Clock className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-text">
                세션이 만료되었습니다
              </h2>
              <p className="mt-1.5 text-[12px] text-text-2 leading-relaxed">
                보안을 위해 자동으로 로그아웃됩니다.<br />
                다시 로그인해주세요.
              </p>
            </div>
            <Button
              variant="primary"
              size="md"
              onClick={logout}
              className="w-full"
            >
              다시 로그인
            </Button>
          </div>
        </div>
      )}

      {/* 컨텐츠 영역 */}
      <main
        className={cn(
          'mx-auto w-full max-w-screen-xl flex-1 px-4 py-6 sm:px-6 lg:px-8',
          className,
        )}
      >
        {children}
      </main>

      <footer className="border-t border-border py-4 text-center text-[12px] text-text-3">
        &copy; {new Date().getFullYear()} AlgoSu. All rights reserved.
      </footer>
    </div>
  );
}
