/**
 * @file Top navigation bar (v2 design system)
 * @domain common
 * @layer component
 * @related Logo, NotificationBell, AuthContext, StudyContext
 */

'use client';

import type { ReactNode } from 'react';
import { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sun,
  Moon,
  ChevronDown,
  Menu,
  X,
  User,
  Settings,
  LogOut,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useStudy } from '@/contexts/StudyContext';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import { Logo } from '@/components/ui/Logo';
import { getAvatarSrc, getAvatarPresetKey } from '@/lib/avatars';

// ─── CONSTANTS ───────────────────────────────

const NAV_LINKS = [
  { href: '/dashboard', labelKey: 'dashboard' },
  { href: '/problems', labelKey: 'problems' },
  { href: '/submissions', labelKey: 'submissions' },
  { href: '/study-room', labelKey: 'studyRoom' },
  { href: '/analytics', labelKey: 'analytics' },
] as const;

// ─── STUDY SELECTOR ──────────────────────────

function StudySelector(): ReactNode {
  const { currentStudyId, studies, setCurrentStudy } = useStudy();
  const t = useTranslations('layout');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const currentStudy = studies.find((s) => s.id === currentStudyId);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (studies.length === 0) {
    return (
      <Link
        href="/studies"
        className="inline-flex items-center gap-1 rounded-badge bg-bg-alt px-2.5 py-1 text-[11px] font-medium text-text-2 transition-colors hover:text-text"
      >
        {t('topNav.selectStudy')}
      </Link>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={t('topNav.switchStudy')}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-1.5 rounded-badge bg-primary-soft px-3 py-1.5 text-[11px] font-medium text-text-2 border border-border transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {currentStudy?.avatar_url ? (
          <Image
            src={getAvatarSrc(getAvatarPresetKey(currentStudy.avatar_url))}
            alt=""
            width={20}
            height={20}
            className="h-5 w-5 shrink-0 rounded-[4px]"
          />
        ) : (
          <div
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] text-[9px] font-bold text-white"
            style={{ background: 'var(--primary)' }}
          >
            {currentStudy?.name?.charAt(0) ?? ''}
          </div>
        )}
        <span className="max-w-[48px] truncate sm:max-w-[80px]">
          {currentStudy?.name ?? t('topNav.selectStudy')}
        </span>
        <ChevronDown className="h-3 w-3 shrink-0" aria-hidden />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={t('topNav.studyList')}
          className="absolute left-0 top-full z-50 mt-1 min-w-[140px] overflow-hidden rounded-card border border-border bg-bg-card shadow-card"
        >
          {studies.map((study) => (
            <button
              key={study.id}
              role="option"
              aria-selected={study.id === currentStudyId}
              type="button"
              className={cn(
                'flex w-full items-center gap-2 px-3 py-2.5 text-left text-[12px] transition-colors',
                study.id === currentStudyId
                  ? 'bg-primary-soft text-primary'
                  : 'text-text hover:bg-bg-alt',
              )}
              onClick={() => {
                setCurrentStudy(study.id);
                setOpen(false);
              }}
            >
              {study.avatar_url ? (
                <Image
                  src={getAvatarSrc(getAvatarPresetKey(study.avatar_url))}
                  alt=""
                  width={20}
                  height={20}
                  className="h-5 w-5 shrink-0 rounded-[4px]"
                />
              ) : (
                <div
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] text-[9px] font-bold text-white"
                  style={{
                    background: study.id === currentStudyId
                      ? 'var(--primary)'
                      : 'var(--text-3)',
                  }}
                >
                  {study.name.charAt(0)}
                </div>
              )}
              <span className="truncate">{study.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── PROFILE DROPDOWN ────────────────────────

function ProfileDropdown(): ReactNode {
  const { user, logout } = useAuth();
  const t = useTranslations('layout');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = useCallback(() => {
    setOpen(false);
    logout();
  }, [logout]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={t('topNav.profileMenuLabel', { email: user?.email ?? '' })}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="w-8 h-8 shrink-0 overflow-hidden rounded-full transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Image
          src={getAvatarSrc(user?.avatarPreset ?? 'default')}
          alt={t('topNav.avatarAlt', { name: user?.email ?? t('topNav.defaultUser') })}
          width={32}
          height={32}
          className="h-full w-full"
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={t('topNav.profileMenuTitle')}
          className="absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-card border border-border bg-bg-card shadow-card"
        >
          {/* User info */}
          <div className="border-b border-border px-3 py-2.5">
            <p className="truncate text-[12px] font-medium text-text">
              {user?.email ?? ''}
            </p>
          </div>

          {/* Menu items */}
          <div className="py-1">
            <Link
              href="/profile"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-text-2 transition-colors hover:bg-bg-alt hover:text-text"
            >
              <User className="h-3.5 w-3.5" aria-hidden />
              {t('topNav.profile')}
            </Link>
            <Link
              href="/settings"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-text-2 transition-colors hover:bg-bg-alt hover:text-text"
            >
              <Settings className="h-3.5 w-3.5" aria-hidden />
              {t('topNav.settings')}
            </Link>
          </div>

          <div className="border-t border-border py-1">
            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-error transition-colors hover:bg-error-soft"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden />
              {t('topNav.logout')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TOP NAV ─────────────────────────────────

/**
 * Top navigation bar (glass-nav + v2 tokens)
 * @domain common
 */
export function TopNav(): ReactNode {
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();
  const { currentStudyId } = useStudy();
  const { theme, setTheme } = useTheme();
  const t = useTranslations('layout');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const hasStudy = isAuthenticated && currentStudyId !== null;

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  return (
    <header className="sticky top-0 z-50 border-b border-border glass-nav">
      <nav
        className="mx-auto flex max-w-container items-center justify-between px-5 py-3"
        aria-label={t('topNav.mainNav')}
      >
        {/* Logo */}
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 text-text transition-opacity hover:opacity-80 font-bold text-base tracking-tight"
        >
          <Logo size={28} />
          <span className="hidden sm:inline">AlgoSu</span>
        </Link>

        {/* Nav items */}
        {hasStudy && (
          <ul className="hidden items-center gap-1.5 sm:flex" role="list">
            {NAV_LINKS.map(({ href, labelKey }) => {
              const isActive = pathname === href || pathname.startsWith(href + '/');
              return (
                <li key={href}>
                  <Link
                    href={href}
                    className={cn(
                      'inline-block transition-colors duration-150 px-3 py-[5px] text-xs font-medium rounded-sm',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                      isActive
                        ? 'bg-primary-soft text-primary'
                        : 'text-text-2 hover:bg-bg-alt hover:text-text',
                    )}
                  >
                    {t(`topNav.nav.${labelKey}`)}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {/* Mobile hamburger */}
        {hasStudy && (
          <button
            type="button"
            aria-label={mobileMenuOpen ? t('topNav.closeMenu') : t('topNav.openMenu')}
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="flex items-center justify-center bg-bg-alt text-text-3 transition-colors hover:text-text sm:hidden w-9 h-9 rounded-sm"
          >
            {mobileMenuOpen ? (
              <X className="h-4 w-4" aria-hidden />
            ) : (
              <Menu className="h-4 w-4" aria-hidden />
            )}
          </button>
        )}

        {/* Right area */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {isAuthenticated && <StudySelector />}

          {/* Language switcher */}
          <LanguageSwitcher />

          {/* Theme toggle */}
          <button
            type="button"
            aria-label={t('topNav.toggleTheme')}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="relative flex items-center justify-center bg-transparent text-text-3 transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary w-8 h-8 rounded-sm"
          >
            <Sun className="h-3.5 w-3.5 dark:hidden" aria-hidden />
            <Moon className="hidden h-3.5 w-3.5 dark:block" aria-hidden />
          </button>

          {isAuthenticated ? (
            <>
              <NotificationBell />
              <ProfileDropdown />
            </>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center justify-center bg-primary text-white transition-colors hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary px-[10px] py-[5px] text-[11px] font-semibold tracking-[0.2px] rounded-btn"
            >
              {t('topNav.login')}
            </Link>
          )}
        </div>
      </nav>

      {/* Mobile dropdown */}
      {hasStudy && mobileMenuOpen && (
        <div className="border-t border-border px-4 py-2 sm:hidden">
          <ul className="flex flex-col gap-1" role="list">
            {NAV_LINKS.map(({ href, labelKey }) => {
              const isActive = pathname === href || pathname.startsWith(href + '/');
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'block transition-colors duration-150 px-3 py-3 text-sm font-medium rounded-sm',
                      isActive
                        ? 'bg-primary-soft text-primary'
                        : 'text-text-2 hover:bg-bg-alt hover:text-text',
                    )}
                  >
                    {t(`topNav.nav.${labelKey}`)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </header>
  );
}
