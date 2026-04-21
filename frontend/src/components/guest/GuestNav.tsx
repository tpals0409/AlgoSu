/**
 * @file 게스트 전용 내비게이션 바
 * @domain guest
 * @layer component
 * @related /guest page, /guest/preview/[slug] page, Logo
 *
 * AppLayout/Sidebar 없이 인증 없이 접근 가능한 간단한 nav.
 * 로고 + 회원가입 CTA + 테마 토글 구성.
 */

'use client';

import type { ReactElement } from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { eventTracker } from '@/lib/event-tracker';

/** 현재 테마 토글 버튼 */
function ThemeToggle(): ReactElement {
  const { resolvedTheme, setTheme } = useTheme();

  function toggle(): void {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="flex h-9 w-9 items-center justify-center rounded-btn text-text-3 transition-colors hover:bg-bg-alt hover:text-text"
      aria-label="테마 전환"
    >
      {resolvedTheme === 'dark' ? (
        <Moon className="h-4 w-4" />
      ) : (
        <Sun className="h-4 w-4" />
      )}
    </button>
  );
}

/**
 * 게스트 모드 전용 고정 내비게이션
 * Glassmorphism glass-nav 토큰 적용, 기존 인증 컴포넌트 미사용.
 */
export function GuestNav(): ReactElement {
  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-border glass-nav">
      <div className="mx-auto flex h-14 max-w-container items-center justify-between px-6">
        {/* 로고 + 서비스명 */}
        <Link
          href="/guest"
          className="flex items-center gap-2 text-base font-bold tracking-tight text-text"
          aria-label="AlgoSu 게스트 홈으로"
        >
          <Logo size={28} />
          <span>AlgoSu</span>
          <span className="ml-1 hidden text-xs font-medium text-text-3 sm:inline">
            둘러보기
          </span>
        </Link>

        {/* 우측 액션 */}
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/login"
            onClick={() => eventTracker?.track('guest:cta_signup_click', { meta: { from: 'nav' } })}
            className="flex h-9 items-center rounded-btn bg-primary px-4 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            회원가입
          </Link>
        </div>
      </div>
    </nav>
  );
}
