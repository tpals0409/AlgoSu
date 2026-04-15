/**
 * @file 법적 페이지 공통 레이아웃 (privacy, terms)
 * @domain common
 * @layer layout
 * @related /privacy, /terms
 */

import Link from 'next/link';
import type { ReactNode } from 'react';

interface LegalLayoutProps {
  readonly children: ReactNode;
}

/**
 * 법적 문서 페이지 레이아웃 — Nav + Main + Footer
 * Server Component (정적 렌더링)
 */
export function LegalLayout({ children }: LegalLayoutProps): ReactNode {
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
              개인정보처리방침
            </Link>
            <span aria-hidden>·</span>
            <Link href="/terms" className="transition-colors hover:text-text">
              이용약관
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
