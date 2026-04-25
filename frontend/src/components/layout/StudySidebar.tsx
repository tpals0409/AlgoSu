/**
 * @file Study sidebar (v2 design system)
 * @domain study
 * @layer component
 * @related StudyContext, AppLayout
 *
 * Study-specific sidebar.
 * Desktop: fixed left, Mobile(< md): slide overlay + backdrop.
 * Navigation: Overview | Problems | Submissions | Members | Settings (ADMIN only)
 */

'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from '@/i18n/navigation';
import {
  LayoutDashboard,
  BookOpen,
  FileText,
  Users,
  Settings,
  ChevronDown,
  PanelLeftClose,
  PanelLeft,
  Menu,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { useStudy } from '@/contexts/StudyContext';
import { getAvatarPresetKey, getAvatarSrc } from '@/lib/avatars';
import Image from 'next/image';

// ─── SIDEBAR NAV ITEMS ──────────────────────

interface SidebarLink {
  href: (studyId: string) => string;
  labelKey: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
}

const SIDEBAR_LINKS: SidebarLink[] = [
  { href: (id) => `/studies/${id}`, labelKey: 'overview', icon: LayoutDashboard },
  { href: (id) => `/studies/${id}/problems`, labelKey: 'problems', icon: BookOpen },
  { href: (id) => `/studies/${id}/submissions`, labelKey: 'submissions', icon: FileText },
  { href: (id) => `/studies/${id}/members`, labelKey: 'members', icon: Users },
  { href: (id) => `/studies/${id}/settings`, labelKey: 'settings', icon: Settings, adminOnly: true },
];

// ─── STUDY SIDEBAR ──────────────────────────

export function StudySidebar(): ReactNode {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations('layout');
  const {
    currentStudyId,
    currentStudyName,
    currentStudyRole,
    studies,
    setCurrentStudy,
  } = useStudy();

  const currentStudy = currentStudyId
    ? studies.find((s) => s.id === currentStudyId)
    : null;

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [studyDropdownOpen, setStudyDropdownOpen] = useState(false);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (!currentStudyId) return null;

  const isAdmin = currentStudyRole === 'ADMIN';

  // Shared nav content (used in both desktop aside and mobile overlay)
  const navContent = (
    <>
      {/* Study selector header */}
      <div className="border-b border-border px-3 py-3">
        {/* Desktop: collapsed view */}
        {collapsed && (
          <div className="hidden md:block">
            <button
              type="button"
              aria-label={t('studySidebar.expandSidebar')}
              onClick={() => setCollapsed(false)}
              className="flex h-7 w-7 items-center justify-center rounded-badge text-text-3 transition-colors hover:bg-bg-alt hover:text-text"
            >
              <PanelLeft className="h-4 w-4" aria-hidden />
            </button>
          </div>
        )}

        {/* Expanded view (always shown on mobile overlay, conditionally on desktop) */}
        <div className={cn(collapsed ? 'md:hidden' : '')}>
          <div className="flex items-center justify-between gap-1">
            <div className="relative min-w-0 flex-1">
              <button
                type="button"
                aria-label={t('studySidebar.switchStudy')}
                aria-haspopup="listbox"
                aria-expanded={studyDropdownOpen}
                onClick={() => setStudyDropdownOpen((prev) => !prev)}
                className="flex w-full items-center gap-1.5 rounded-badge bg-primary-soft px-2.5 py-1.5 text-[12px] font-semibold text-text transition-colors hover:bg-primary-soft2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {currentStudy?.avatar_url ? (
                  <Image
                    src={getAvatarSrc(getAvatarPresetKey(currentStudy.avatar_url))}
                    alt={currentStudyName ?? ''}
                    width={20}
                    height={20}
                    className="h-5 w-5 shrink-0 rounded-[4px]"
                  />
                ) : (
                  <div
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] text-[9px] font-bold text-white"
                    style={{ background: 'var(--primary)' }}
                  >
                    {currentStudyName?.charAt(0) ?? ''}
                  </div>
                )}
                <span className="truncate">{currentStudyName ?? t('studySidebar.studyFallback')}</span>
                <ChevronDown className="h-3 w-3 shrink-0 text-text-3" aria-hidden />
              </button>

              {studyDropdownOpen && (
                <div
                  role="listbox"
                  aria-label={t('studySidebar.studyList')}
                  className="absolute left-0 top-full z-50 mt-1 w-full min-w-[160px] overflow-hidden rounded-card border border-border bg-bg-card shadow-card"
                >
                  {studies.map((study) => (
                    <button
                      key={study.id}
                      role="option"
                      aria-selected={study.id === currentStudyId}
                      type="button"
                      className={cn(
                        'flex w-full items-center px-3 py-2 text-left text-[12px] transition-colors',
                        study.id === currentStudyId
                          ? 'bg-primary-soft text-primary'
                          : 'text-text hover:bg-bg-alt',
                      )}
                      onClick={() => {
                        setCurrentStudy(study.id);
                        setStudyDropdownOpen(false);
                        router.push(`/studies/${study.id}`);
                      }}
                    >
                      {study.avatar_url ? (
                        <Image
                          src={getAvatarSrc(getAvatarPresetKey(study.avatar_url))}
                          alt={study.name}
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

            {/* Desktop: collapse toggle */}
            <button
              type="button"
              aria-label={t('studySidebar.collapseSidebar')}
              onClick={() => setCollapsed(true)}
              className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-badge text-text-3 transition-colors hover:bg-bg-alt hover:text-text md:flex"
            >
              <PanelLeftClose className="h-4 w-4" aria-hidden />
            </button>

            {/* Mobile: close button */}
            <button
              type="button"
              aria-label={t('studySidebar.closeSidebar')}
              onClick={closeMobile}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-badge text-text-3 transition-colors hover:bg-bg-alt hover:text-text md:hidden"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      </div>

      {/* Navigation links */}
      <nav className="flex-1 overflow-y-auto py-2" aria-label={t('studySidebar.studyNav')}>
        <ul className="flex flex-col gap-0.5 px-2" role="list">
          {SIDEBAR_LINKS.map(({ href, labelKey, icon: Icon, adminOnly }) => {
            if (adminOnly && !isAdmin) return null;

            const linkHref = href(currentStudyId);
            const isActive =
              pathname === linkHref || pathname.startsWith(linkHref + '/');
            const label = t(`studySidebar.nav.${labelKey}`);

            return (
              <li key={labelKey}>
                <Link
                  href={linkHref}
                  title={collapsed ? label : undefined}
                  onClick={closeMobile}
                  className={cn(
                    'flex items-center gap-2.5 rounded-badge text-xs transition-colors duration-150',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    isActive
                      ? 'bg-primary-soft text-primary font-medium'
                      : 'text-text-2 hover:bg-bg-alt hover:text-text',
                    collapsed ? 'md:justify-center md:px-0 px-3 py-2' : 'px-3 py-2',
                  )}
                >
                  <Icon
                    className={cn(
                      'h-4 w-4 shrink-0',
                      isActive ? 'text-primary' : 'text-text-3',
                    )}
                    aria-hidden
                  />
                  {collapsed ? (
                    <span className="md:hidden">{label}</span>
                  ) : (
                    <span>{label}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );

  return (
    <>
      {/* Mobile: hamburger trigger button */}
      <button
        type="button"
        aria-label={t('studySidebar.openStudyMenu')}
        onClick={() => setMobileOpen(true)}
        className="fixed bottom-4 right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full shadow-lg md:hidden"
        style={{ background: 'var(--primary)', color: 'white' }}
      >
        <Menu className="h-5 w-5" aria-hidden />
      </button>

      {/* Mobile: backdrop overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={closeMobile}
          aria-hidden
        />
      )}

      {/* Mobile: slide-in overlay sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 flex h-screen w-[220px] flex-col border-r border-border bg-bg transition-transform duration-300 md:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {navContent}
      </aside>

      {/* Desktop: static sidebar */}
      <aside
        className={cn(
          'hidden shrink-0 flex-col border-r border-border bg-bg transition-all duration-200 md:flex',
          collapsed ? 'w-[52px]' : 'w-[220px]',
        )}
      >
        {navContent}
      </aside>
    </>
  );
}
