/**
 * @file Guest-only navigation bar
 * @domain guest
 * @layer component
 * @related /guest page, /guest/preview/[slug] page, Logo
 *
 * Simple nav accessible without authentication, no AppLayout/Sidebar.
 * Logo + sign-up CTA + theme toggle.
 */

'use client';

import type { ReactElement } from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Logo } from '@/components/ui/Logo';
import { eventTracker } from '@/lib/event-tracker';

/** Current theme toggle button */
function ThemeToggle(): ReactElement {
  const { resolvedTheme, setTheme } = useTheme();
  const t = useTranslations('common');

  function toggle(): void {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="flex h-9 w-9 items-center justify-center rounded-btn text-text-3 transition-colors hover:bg-bg-alt hover:text-text"
      aria-label={t('guestNav.themeToggle')}
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
 * Guest mode fixed navigation bar.
 * Glassmorphism glass-nav token applied, no auth components used.
 */
export function GuestNav(): ReactElement {
  const t = useTranslations('common');

  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-border glass-nav">
      <div className="mx-auto flex h-14 max-w-container items-center justify-between px-6">
        {/* Logo + service name */}
        <Link
          href="/guest"
          className="flex items-center gap-2 text-base font-bold tracking-tight text-text"
          aria-label={t('guestNav.homeAria')}
        >
          <Logo size={28} />
          <span>AlgoSu</span>
          <span className="ml-1 hidden text-xs font-medium text-text-3 sm:inline">
            {t('guestNav.explore')}
          </span>
        </Link>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/login"
            onClick={() => eventTracker?.track('guest:cta_signup_click', { meta: { from: 'nav' } })}
            className="flex h-9 items-center rounded-btn bg-primary px-4 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            {t('guestNav.signup')}
          </Link>
        </div>
      </div>
    </nav>
  );
}
