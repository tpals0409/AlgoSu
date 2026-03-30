/**
 * @file 스터디 사이드바 (v2 디자인 시스템)
 * @domain study
 * @layer component
 * @related StudyContext, TopNav
 *
 * 스터디 페이지 전용 사이드바.
 * 데스크톱: 좌측 고정, 모바일(< md): 슬라이드 오버레이 + 백드롭.
 * 네비게이션: 개요 | 문제 | 제출 | 멤버 | 설정 (ADMIN만)
 */

'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
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
import { cn } from '@/lib/utils';
import { useStudy } from '@/contexts/StudyContext';
import { getAvatarPresetKey, getAvatarSrc } from '@/lib/avatars';
import Image from 'next/image';

// ─── SIDEBAR NAV ITEMS ──────────────────────

interface SidebarLink {
  href: (studyId: string) => string;
  label: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
}

const SIDEBAR_LINKS: SidebarLink[] = [
  { href: (id) => `/studies/${id}`, label: '개요', icon: LayoutDashboard },
  { href: (id) => `/studies/${id}/problems`, label: '문제', icon: BookOpen },
  { href: (id) => `/studies/${id}/submissions`, label: '제출', icon: FileText },
  { href: (id) => `/studies/${id}/members`, label: '멤버', icon: Users },
  { href: (id) => `/studies/${id}/settings`, label: '설정', icon: Settings, adminOnly: true },
];

// ─── STUDY SIDEBAR ──────────────────────────

export function StudySidebar(): ReactNode {
  const pathname = usePathname();
  const router = useRouter();
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
      {/* 스터디 선택 헤더 */}
      <div className="border-b border-border px-3 py-3">
        {/* Desktop: collapsed view */}
        {collapsed && (
          <div className="hidden md:block">
            <button
              type="button"
              aria-label="사이드바 확장"
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
                aria-label="스터디 전환"
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
                <span className="truncate">{currentStudyName ?? '스터디'}</span>
                <ChevronDown className="h-3 w-3 shrink-0 text-text-3" aria-hidden />
              </button>

              {studyDropdownOpen && (
                <div
                  role="listbox"
                  aria-label="스터디 목록"
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
              aria-label="사이드바 접기"
              onClick={() => setCollapsed(true)}
              className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-badge text-text-3 transition-colors hover:bg-bg-alt hover:text-text md:flex"
            >
              <PanelLeftClose className="h-4 w-4" aria-hidden />
            </button>

            {/* Mobile: close button */}
            <button
              type="button"
              aria-label="사이드바 닫기"
              onClick={closeMobile}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-badge text-text-3 transition-colors hover:bg-bg-alt hover:text-text md:hidden"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      </div>

      {/* 네비게이션 링크 */}
      <nav className="flex-1 overflow-y-auto py-2" aria-label="스터디 내비게이션">
        <ul className="flex flex-col gap-0.5 px-2" role="list">
          {SIDEBAR_LINKS.map(({ href, label, icon: Icon, adminOnly }) => {
            if (adminOnly && !isAdmin) return null;

            const linkHref = href(currentStudyId);
            const isActive =
              pathname === linkHref || pathname.startsWith(linkHref + '/');

            return (
              <li key={label}>
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
        aria-label="스터디 메뉴 열기"
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
