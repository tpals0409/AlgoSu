/**
 * @file Auth shell layout — login/signup common header
 * @domain common
 * @layer component
 * @related LanguageSwitcher, Logo, (auth)/layout.tsx
 *
 * Provides a common top header (Logo + LanguageSwitcher) for auth group pages.
 * Fixed header with glassmorphism style, pt-12 content offset.
 *
 * Note: No user-facing translatable strings in this component.
 * Brand name "AlgoSu" is intentionally not translated.
 */

'use client';

import { type ReactNode, Suspense } from 'react';
import { Link } from '@/i18n/navigation';
import { Logo } from '@/components/ui/Logo';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';

interface AuthShellProps {
  readonly children: ReactNode;
}

/**
 * Auth shell layout.
 *
 * - Fixed top header: Logo + AlgoSu link (left), LanguageSwitcher (right)
 * - Glassmorphism style (glass-nav) + border-b border-border
 * - Content area: pt-12 offset for header height
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
        <Suspense fallback={null}>
          <LanguageSwitcher />
        </Suspense>
      </header>
      <main className="pt-12">{children}</main>
    </>
  );
}
