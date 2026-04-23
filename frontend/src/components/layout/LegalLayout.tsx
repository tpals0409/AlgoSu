/**
 * @file Legal page common layout (privacy, terms)
 * @domain common
 * @layer layout
 * @related /privacy, /terms
 */

'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';

interface LegalLayoutProps {
  readonly children: ReactNode;
}

/**
 * Legal document page layout — Nav + Main + Footer
 */
export function LegalLayout({ children }: LegalLayoutProps): ReactNode {
  const t = useTranslations('layout');

  return (
    <div className="flex min-h-screen flex-col bg-bg text-text">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-6">
          <Link
            href="/"
            className="text-base font-bold tracking-tight text-text transition-colors hover:text-primary"
          >
            AlgoSu
          </Link>
        </div>
      </nav>

      {/* Main */}
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 px-6">
          <div className="flex items-center gap-4 text-[12px] font-medium text-text-3">
            <Link href="/privacy" className="transition-colors hover:text-text">
              {t('legalLayout.privacy')}
            </Link>
            <span aria-hidden>&middot;</span>
            <Link href="/terms" className="transition-colors hover:text-text">
              {t('legalLayout.terms')}
            </Link>
          </div>
          <p className="text-[11px] text-text-3">
            &copy; {new Date().getFullYear()} AlgoSu. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
