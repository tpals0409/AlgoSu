/**
 * @file App layout (v3 sidebar design)
 * @domain common
 * @layer component
 * @related NotificationBell, AuthContext, StudyContext, LanguageSwitcher
 *
 * Desktop(>= md/768px): Left 220px fixed sidebar
 * Mobile(< md/768px): Right slide overlay sidebar + top mobile header
 * Includes session expired overlay.
 */

'use client';

import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from '@/i18n/navigation';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  FileText,
  MessagesSquare,
  BarChart3,
  Settings,
  User,
  Sun,
  Moon,
  Menu,
  X,
  ChevronDown,
  Check,
  Plus,
  LogOut,
  Shield,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import { Toaster } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useStudy } from '@/contexts/StudyContext';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import { FeedbackWidget } from '@/components/feedback/FeedbackWidget';
import { Logo } from '@/components/ui/Logo';
import { getAvatarSrc, getAvatarPresetKey } from '@/lib/avatars';

// ─── CONSTANTS ───────────────────────────────

const NAV_ITEMS = [
  { labelKey: 'dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { labelKey: 'myStudies', icon: Users, href: '/studies' },
  { labelKey: 'problems', icon: BookOpen, href: '/problems' },
  { labelKey: 'submissions', icon: FileText, href: '/submissions' },
  { labelKey: 'studyRoom', icon: MessagesSquare, href: '/study-room' },
  { labelKey: 'analytics', icon: BarChart3, href: '/analytics' },
] as const;

// ─── HELPERS ─────────────────────────────────

function useClickOutside(
  ref: React.RefObject<HTMLElement | null>,
  handler: () => void,
) {
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        handler();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [ref, handler]);
}

// ─── STUDY SELECTOR (SIDEBAR) ────────────────

function SidebarStudySelector({
  onNavigate,
}: {
  onNavigate: () => void;
}): ReactNode {
  const { currentStudyId, currentStudyName, studies, setCurrentStudy } =
    useStudy();
  const t = useTranslations('layout');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const closeDropdown = useCallback(() => setOpen(false), []);
  useClickOutside(ref, closeDropdown);

  const currentStudy = studies.find((s) => s.id === currentStudyId);
  const displayName = currentStudy?.name ?? currentStudyName ?? t('appLayout.selectStudy');

  if (studies.length === 0) {
    return (
      <div className="px-3 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <Link
          href="/studies"
          onClick={onNavigate}
          className="flex w-full items-center gap-2 rounded-btn px-2 py-1.5 text-left text-[12px] font-medium text-text-2 transition-colors hover:bg-bg-alt hover:text-text"
        >
          <Plus className="h-4 w-4 shrink-0" aria-hidden />
          {t('appLayout.selectStudy')}
        </Link>
      </div>
    );
  }

  return (
    <div
      className="px-3 py-3"
      style={{ borderBottom: '1px solid var(--border)' }}
      ref={ref}
    >
      <button
        type="button"
        aria-label={t('appLayout.switchStudy')}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-btn px-2 py-1.5 text-left transition-colors hover:bg-bg-alt"
      >
        {currentStudy?.avatar_url ? (
          <Image
            src={getAvatarSrc(getAvatarPresetKey(currentStudy.avatar_url))}
            alt=""
            width={24}
            height={24}
            className="h-6 w-6 shrink-0 rounded-[5px]"
          />
        ) : (
          <div
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[5px] text-[10px] font-bold text-white"
            style={{ background: 'var(--primary)' }}
          >
            {displayName.charAt(0)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-[12px] font-semibold"
            style={{ color: 'var(--text)' }}
          >
            {displayName}
          </p>
          <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>
            {t('appLayout.switchStudy')}
          </p>
        </div>
        <ChevronDown
          className="h-3 w-3 shrink-0 transition-transform duration-200"
          style={{
            color: 'var(--text-3)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
          aria-hidden
        />
      </button>

      {/* Study dropdown */}
      {open && (
        <div
          role="listbox"
          aria-label={t('appLayout.studyList')}
          className="mt-1.5 overflow-hidden rounded-card border"
          style={{
            background: 'var(--bg)',
            borderColor: 'var(--border)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div className="space-y-0.5 p-1">
            {studies.map((study) => {
              const isSelected = study.id === currentStudyId;
              return (
                <button
                  key={study.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    setCurrentStudy(study.id);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-btn px-2.5 py-2 text-left transition-colors hover:bg-bg-alt"
                  style={{
                    background: isSelected
                      ? 'var(--primary-soft)'
                      : 'transparent',
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
                        background: isSelected
                          ? 'var(--primary)'
                          : 'var(--text-3)',
                      }}
                    >
                      {study.name.charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-[12px] font-semibold"
                      style={{
                        color: isSelected ? 'var(--primary)' : 'var(--text)',
                      }}
                    >
                      {study.name}
                    </p>
                  </div>
                  {isSelected && (
                    <Check
                      className="h-3 w-3 shrink-0"
                      style={{ color: 'var(--primary)' }}
                      aria-hidden
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── APP LAYOUT ──────────────────────────────

interface AppLayoutProps {
  readonly children: ReactNode;
  readonly className?: string;
}

export function AppLayout({ children, className }: AppLayoutProps): ReactNode {
  const pathname = usePathname();
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const { currentStudyId } = useStudy();
  const { theme, setTheme } = useTheme();
  const t = useTranslations('layout');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isDark = theme === 'dark';
  const hasStudy = isAuthenticated && currentStudyId !== null;

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  function isActive(href: string): boolean {
    if (href === '/dashboard') return pathname === '/dashboard';
    if (href === '/studies') return pathname === '/studies';
    if (href === '/study-room') return pathname === '/study-room' || /^\/studies\/[^/]+\/room/.test(pathname);
    return pathname === href || pathname.startsWith(href + '/');
  }

  return (
    <>
      <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
        {/* ── Sidebar ────────────────────────────────────── */}
        {hasStudy && (
          <>
            {/* Mobile overlay backdrop */}
            {sidebarOpen && (
              <div
                className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
                onClick={closeSidebar}
                aria-hidden
              />
            )}

            <aside
              className={cn(
                'fixed right-0 top-0 z-50 flex h-screen w-[220px] flex-col border-l transition-transform duration-300',
                'md:left-0 md:right-auto md:border-l-0 md:border-r md:translate-x-0',
                sidebarOpen
                  ? 'translate-x-0'
                  : 'translate-x-full md:translate-x-0',
              )}
              style={{
                background: 'var(--bg-card)',
                borderColor: 'var(--border)',
              }}
            >
              {/* Logo area */}
              <div
                className="flex h-14 items-center justify-between px-4"
                style={{ borderBottom: '1px solid var(--border)' }}
              >
                <Link
                  href="/dashboard"
                  className="flex items-center gap-2"
                  onClick={closeSidebar}
                >
                  <Logo size={28} />
                  <span
                    className="text-[15px] font-bold tracking-tight"
                    style={{ color: 'var(--text)' }}
                  >
                    AlgoSu
                  </span>
                </Link>
                <button
                  type="button"
                  aria-label={t('appLayout.closeSidebar')}
                  onClick={closeSidebar}
                  className="rounded-btn p-1 md:hidden"
                  style={{ color: 'var(--text-3)' }}
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>

              {/* Study selector */}
              <SidebarStudySelector onNavigate={closeSidebar} />

              {/* Nav items */}
              <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={closeSidebar}
                      className={cn(
                        'flex items-center gap-2.5 rounded-btn px-3 py-2 text-[13px] font-medium transition-all duration-150',
                        active
                          ? 'bg-primary-soft text-primary'
                          : 'text-text-3 hover:bg-bg-alt hover:text-text-2',
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden />
                      {t(`appLayout.nav.${item.labelKey}`)}
                    </Link>
                  );
                })}
              </nav>

              {/* Bottom section */}
              <div
                className="space-y-0.5 px-3 py-3"
                style={{ borderTop: '1px solid var(--border)' }}
              >
                <NotificationBell placement="sidebar" />

                {/* Theme toggle */}
                <button
                  type="button"
                  aria-label={t('appLayout.toggleTheme')}
                  onClick={() => setTheme(isDark ? 'light' : 'dark')}
                  className="flex w-full items-center gap-2.5 rounded-btn px-3 py-2 text-[13px] font-medium text-text-3 transition-all duration-150 hover:bg-bg-alt hover:text-text-2"
                >
                  {isDark ? (
                    <Moon className="h-4 w-4 shrink-0" aria-hidden />
                  ) : (
                    <Sun className="h-4 w-4 shrink-0" aria-hidden />
                  )}
                  {isDark ? t('appLayout.darkMode') : t('appLayout.lightMode')}
                </button>

                {/* Language switcher */}
                <div className="px-3 py-1.5">
                  <LanguageSwitcher />
                </div>

                {/* Profile link */}
                <Link
                  href="/profile"
                  onClick={closeSidebar}
                  className={cn(
                    'flex items-center gap-2.5 rounded-btn px-3 py-2 text-[13px] font-medium transition-all duration-150',
                    pathname === '/profile'
                      ? 'bg-primary-soft text-primary'
                      : 'text-text-3 hover:bg-bg-alt hover:text-text-2',
                  )}
                >
                  {user ? (
                    <Image
                      src={getAvatarSrc(user.avatarPreset ?? 'default')}
                      alt={t('appLayout.avatarAlt', { email: user.email })}
                      width={16}
                      height={16}
                      className="h-4 w-4 shrink-0 rounded-full"
                    />
                  ) : (
                    <User className="h-4 w-4 shrink-0" aria-hidden />
                  )}
                  {t('appLayout.profile')}
                </Link>

                {/* Settings */}
                <Link
                  href="/settings"
                  onClick={closeSidebar}
                  className={cn(
                    'flex items-center gap-2.5 rounded-btn px-3 py-2 text-[13px] font-medium transition-all duration-150',
                    pathname === '/settings'
                      ? 'bg-primary-soft text-primary'
                      : 'text-text-3 hover:bg-bg-alt hover:text-text-2',
                  )}
                >
                  <Settings className="h-4 w-4 shrink-0" aria-hidden />
                  {t('appLayout.settings')}
                </Link>

                {/* Admin */}
                {isAdmin && (
                  <Link
                    href="/admin"
                    onClick={closeSidebar}
                    className={cn(
                      'flex items-center gap-2.5 rounded-btn px-3 py-2 text-[13px] font-medium transition-all duration-150',
                      pathname.startsWith('/admin')
                        ? 'bg-primary-soft text-primary'
                        : 'text-text-3 hover:bg-bg-alt hover:text-text-2',
                    )}
                  >
                    <Shield className="h-4 w-4 shrink-0" aria-hidden />
                    {t('appLayout.admin')}
                  </Link>
                )}

              </div>
            </aside>
          </>
        )}

        {/* ── No-study top bar (logout access) ──────────── */}
        {isAuthenticated && !hasStudy && (
          <header
            className="fixed left-0 right-0 top-0 z-30 flex h-14 items-center justify-between border-b px-4"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
          >
            <Link href="/studies" className="flex items-center gap-2">
              <Logo size={24} />
              <span className="text-[14px] font-bold" style={{ color: 'var(--text)' }}>
                AlgoSu
              </span>
            </Link>
            <div className="flex items-center gap-2">
              <LanguageSwitcher />
              <button
                type="button"
                onClick={logout}
                className="flex items-center gap-1.5 rounded-btn px-3 py-1.5 text-[13px] font-medium text-text-3 transition-colors hover:bg-bg-alt hover:text-error"
              >
                <LogOut className="h-4 w-4" aria-hidden />
                {t('appLayout.logout')}
              </button>
            </div>
          </header>
        )}

        {/* ── Mobile top bar ─────────────────────────────── */}
        {hasStudy && (
          <header
            className="glass-nav fixed right-0 top-0 z-30 flex h-14 items-center justify-between border-b px-4 md:hidden"
            style={{ left: 0, borderColor: 'var(--border)' }}
          >
            <Link
              href="/dashboard"
              className="flex items-center gap-2"
            >
              <Logo size={24} />
              <span
                className="text-[14px] font-bold"
                style={{ color: 'var(--text)' }}
              >
                AlgoSu
              </span>
            </Link>
            <div className="relative">
              <button
                type="button"
                aria-label={t('appLayout.openMenu')}
                onClick={() => setSidebarOpen(true)}
                className="rounded-btn p-1.5"
                style={{ color: 'var(--text-3)' }}
              >
                <Menu className="h-5 w-5" aria-hidden />
              </button>
            </div>
          </header>
        )}

        {/* ── Demo banner ─────────────────────────────── */}
        {user?.email === 'demo@algosu.kr' && (
          <div
            className={cn(
              'fixed left-0 right-0 z-20 flex items-center justify-center gap-2 border-b py-1.5 text-[12px] font-medium',
              hasStudy ? 'md:ml-[220px]' : '',
            )}
            style={{
              top: hasStudy ? '0' : '56px',
              background: 'var(--warning-bg, #fef3c7)',
              borderColor: 'var(--warning-border, #fde68a)',
              color: 'var(--warning-text, #92400e)',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="12" r="10" />
              <polygon points="10 8 16 12 10 16 10 8" />
            </svg>
            {t('appLayout.demoBanner')}
          </div>
        )}

        {/* ── Main content ───────────────────────────────── */}
        <main id="main-content" className={hasStudy ? 'md:ml-[220px]' : ''}>
          <div
            className={cn(
              hasStudy
                ? 'px-4 py-6 pt-[72px] md:px-6 md:pt-6'
                : isAuthenticated
                  ? 'mx-auto w-full max-w-container px-4 py-6 pt-[72px] sm:px-6 lg:px-8'
                  : 'mx-auto w-full max-w-container px-4 py-6 sm:px-6 lg:px-8',
              className,
            )}
          >
            {children}
          </div>
        </main>
      </div>

      {isAuthenticated && <FeedbackWidget />}
      <Toaster
        theme={isDark ? 'dark' : 'light'}
        position="bottom-right"
        richColors
        toastOptions={{
          style: {
            fontFamily: 'inherit',
            borderRadius: 'var(--radius-card)',
            fontSize: '13px',
            border: '1px solid var(--border)',
          },
        }}
      />
    </>
  );
}
