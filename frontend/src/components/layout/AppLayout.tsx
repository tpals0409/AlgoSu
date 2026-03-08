/**
 * @file 앱 레이아웃 (v3 사이드바 디자인)
 * @domain common
 * @layer component
 * @related NotificationBell, AuthContext, StudyContext
 *
 * 데스크탑(>= md/768px): 왼쪽 220px 고정 사이드바
 * 모바일(< md/768px): 오른쪽 슬라이드 오버레이 사이드바 + 상단 모바일 헤더
 * 세션 만료 오버레이 포함.
 */

'use client';

import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  FileText,
  MessagesSquare,
  BarChart3,
  User,
  Sun,
  Moon,
  Menu,
  X,
  ChevronDown,
  Check,
  Plus,
  Clock,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { Toaster } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useStudy } from '@/contexts/StudyContext';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { Logo } from '@/components/ui/Logo';
import { Btn } from '@/components/ui/AlgosuUI';
import { getAvatarSrc } from '@/lib/avatars';

// ─── CONSTANTS ───────────────────────────────

const NAV_ITEMS = [
  { label: '대시보드', icon: LayoutDashboard, href: '/dashboard' },
  { label: '내 스터디', icon: Users, href: '/studies' },
  { label: '문제 목록', icon: BookOpen, href: '/problems' },
  { label: '제출 이력', icon: FileText, href: '/submissions' },
  { label: '스터디룸', icon: MessagesSquare, href: '/study-room' },
  { label: '통계', icon: BarChart3, href: '/analytics' },
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
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const closeDropdown = useCallback(() => setOpen(false), []);
  useClickOutside(ref, closeDropdown);

  const currentStudy = studies.find((s) => s.id === currentStudyId);
  const displayName = currentStudy?.name ?? currentStudyName ?? '스터디 선택';

  if (studies.length === 0) {
    return (
      <div className="px-3 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <Link
          href="/studies"
          onClick={onNavigate}
          className="flex w-full items-center gap-2 rounded-btn px-2 py-1.5 text-left text-[12px] font-medium text-text-2 transition-colors hover:bg-bg-alt hover:text-text"
        >
          <Plus className="h-4 w-4 shrink-0" aria-hidden />
          스터디 선택
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
        aria-label="스터디 전환"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-btn px-2 py-1.5 text-left transition-colors hover:bg-bg-alt"
      >
        <div
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[5px] text-[10px] font-bold text-white"
          style={{ background: 'var(--primary)' }}
        >
          {displayName.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-[12px] font-semibold"
            style={{ color: 'var(--text)' }}
          >
            {displayName}
          </p>
          <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>
            스터디 전환
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
          aria-label="스터디 목록"
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
  const { user, isAuthenticated, sessionExpired, logout } = useAuth();
  const { currentStudyId } = useStudy();
  const { theme, setTheme } = useTheme();
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
                  aria-label="사이드바 닫기"
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
                      {item.label}
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
                  aria-label="테마 전환"
                  onClick={() => setTheme(isDark ? 'light' : 'dark')}
                  className="flex w-full items-center gap-2.5 rounded-btn px-3 py-2 text-[13px] font-medium text-text-3 transition-all duration-150 hover:bg-bg-alt hover:text-text-2"
                >
                  {isDark ? (
                    <Sun className="h-4 w-4 shrink-0" aria-hidden />
                  ) : (
                    <Moon className="h-4 w-4 shrink-0" aria-hidden />
                  )}
                  {isDark ? '라이트 모드' : '다크 모드'}
                </button>

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
                      alt="아바타"
                      width={16}
                      height={16}
                      className="h-4 w-4 shrink-0 rounded-full"
                    />
                  ) : (
                    <User className="h-4 w-4 shrink-0" aria-hidden />
                  )}
                  프로필
                </Link>
              </div>
            </aside>
          </>
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
                aria-label="메뉴 열기"
                onClick={() => setSidebarOpen(true)}
                className="rounded-btn p-1.5"
                style={{ color: 'var(--text-3)' }}
              >
                <Menu className="h-5 w-5" aria-hidden />
              </button>
            </div>
          </header>
        )}

        {/* ── Session expired overlay ────────────────────── */}
        {sessionExpired && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-bg/80 backdrop-blur-sm animate-fade-in">
            <div className="mx-4 flex w-full max-w-xs flex-col items-center gap-5 rounded-card border border-border bg-bg-card p-8 shadow-modal text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft">
                <Clock className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-text">
                  세션이 만료되었습니다
                </h2>
                <p className="mt-1.5 text-[12px] text-text-2 leading-relaxed">
                  보안을 위해 자동으로 로그아웃됩니다.
                  <br />
                  다시 로그인해주세요.
                </p>
              </div>
              <Btn
                variant="primary"
                size="md"
                onClick={logout}
                className="w-full"
              >
                다시 로그인
              </Btn>
            </div>
          </div>
        )}

        {/* ── Main content ───────────────────────────────── */}
        <main className={hasStudy ? 'md:ml-[220px]' : ''}>
          <div
            className={cn(
              hasStudy
                ? 'px-4 py-6 pt-[72px] md:px-6 md:pt-6'
                : 'mx-auto w-full max-w-container px-4 py-6 sm:px-6 lg:px-8',
              className,
            )}
          >
            {children}
          </div>
        </main>
      </div>

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
