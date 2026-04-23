/**
 * @file Auth 셸 레이아웃 — 로그인/회원가입 페이지 공통 헤더
 * @domain common
 * @layer component
 * @related LanguageSwitcher, Logo, (auth)/layout.tsx
 *
 * Auth 그룹 페이지에 공통 상단 헤더(Logo + LanguageSwitcher)를 제공한다.
 * Glassmorphism 스타일의 고정 헤더와 pt-12로 콘텐츠 오프셋을 적용한다.
 */

'use client';

import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import { Logo } from '@/components/ui/Logo';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';

interface AuthShellProps {
  readonly children: ReactNode;
}

/**
 * Auth 셸 레이아웃.
 *
 * - 상단 고정 헤더: Logo + AlgoSu 링크(왼쪽), LanguageSwitcher(오른쪽)
 * - Glassmorphism 스타일 (glass-nav) + border-b border-border
 * - 콘텐츠 영역: pt-12로 헤더 높이만큼 오프셋
 */
export function AuthShell({ children }: AuthShellProps): ReactNode {
  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 flex h-12 items-center justify-between border-b border-border px-6 glass-nav">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-bold tracking-tight"
        >
          <Logo size={24} />
          AlgoSu
        </Link>
        <LanguageSwitcher />
      </header>
      <main className="pt-12">{children}</main>
    </>
  );
}
