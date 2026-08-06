/**
 * @file Auth shell layout — login/signup common header
 * @domain common
 * @layer component
 * @related LanguageSwitcher, Logo, (auth)/layout.tsx
 *
 * Provides the single top header (Logo + ThemeToggle + LanguageSwitcher) for all
 * auth group pages. Fixed header with glassmorphism style, pt-14 content offset.
 *
 * Sprint 266: 각 auth 페이지가 자체 <nav>(Logo + 테마토글)를 렌더해 AuthShell 헤더와
 * 이중으로 겹치던 문제를 통합. 테마토글을 이 공용 헤더로 흡수하고 페이지별 nav를 제거했다.
 *
 * Note: No user-facing translatable strings except the themeToggle aria-label.
 * Brand name "AlgoSu" is intentionally not translated.
 */

'use client';

import { type ReactNode, Suspense } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Logo } from '@/components/ui/Logo';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';

interface AuthShellProps {
  readonly children: ReactNode;
}

/**
 * Auth shell layout.
 *
 * - Fixed top header: Logo + AlgoSu link (left); ThemeToggle + LanguageSwitcher (right)
 * - Glassmorphism style (glass-nav) + border-b border-border, h-14
 * - Content area: pt-14 offset for header height
 */
export function AuthShell({ children }: AuthShellProps): ReactNode {
  const { resolvedTheme, setTheme } = useTheme();
  const t = useTranslations('common');

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 flex h-14 items-center justify-between border-b border-border px-6 glass-nav">
        <Link
          href="/"
          className="flex items-center gap-2 text-base font-bold tracking-tight"
        >
          <Logo size={28} />
          AlgoSu
        </Link>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="flex h-9 w-9 items-center justify-center rounded-btn text-text-3 hover:text-text hover:bg-bg-alt transition-colors"
            aria-label={t('themeToggle')}
          >
            {resolvedTheme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>
          <Suspense fallback={null}>
            <LanguageSwitcher />
          </Suspense>
        </div>
      </header>
      <main className="pt-14">{children}</main>
    </>
  );
}
