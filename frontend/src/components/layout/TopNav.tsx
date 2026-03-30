/**
 * @file 상단 네비게이션 바 (v2 디자인 시스템)
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
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useStudy } from '@/contexts/StudyContext';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { Logo } from '@/components/ui/Logo';
import { getAvatarSrc, getAvatarPresetKey } from '@/lib/avatars';

// ─── CONSTANTS ───────────────────────────────

const NAV_LINKS = [
  { href: '/dashboard', label: '대시보드' },
  { href: '/problems', label: '문제' },
  { href: '/submissions', label: '제출' },
  { href: '/study-room', label: '스터디룸' },
  { href: '/analytics', label: '분석' },
] as const;

// ─── STUDY SELECTOR ──────────────────────────

function StudySelector(): ReactNode {
  const { currentStudyId, studies, setCurrentStudy } = useStudy();
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
        스터디 선택
      </Link>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="스터디 전환"
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
          {currentStudy?.name ?? '스터디 선택'}
        </span>
        <ChevronDown className="h-3 w-3 shrink-0" aria-hidden />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="스터디 목록"
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
        aria-label={`${user?.email ?? ''} 프로필 메뉴`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="w-8 h-8 shrink-0 overflow-hidden rounded-full transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Image
          src={getAvatarSrc(user?.avatarPreset ?? 'default')}
          alt="아바타"
          width={32}
          height={32}
          className="h-full w-full"
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="프로필 메뉴"
          className="absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-card border border-border bg-bg-card shadow-card"
        >
          {/* 사용자 정보 */}
          <div className="border-b border-border px-3 py-2.5">
            <p className="truncate text-[12px] font-medium text-text">
              {user?.email ?? ''}
            </p>
          </div>

          {/* 메뉴 항목 */}
          <div className="py-1">
            <Link
              href="/profile"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-text-2 transition-colors hover:bg-bg-alt hover:text-text"
            >
              <User className="h-3.5 w-3.5" aria-hidden />
              프로필
            </Link>
            <Link
              href="/profile"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-text-2 transition-colors hover:bg-bg-alt hover:text-text"
            >
              <Settings className="h-3.5 w-3.5" aria-hidden />
              설정
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
              로그아웃
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TOP NAV ─────────────────────────────────

/**
 * 상단 네비게이션 바 (glass-nav + v2 토큰)
 * @domain common
 */
export function TopNav(): ReactNode {
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();
  const { currentStudyId } = useStudy();
  const { theme, setTheme } = useTheme();
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
        aria-label="주 내비게이션"
      >
        {/* 로고 */}
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 text-text transition-opacity hover:opacity-80 font-bold text-base tracking-tight"
        >
          <Logo size={28} />
          <span className="hidden sm:inline">AlgoSu</span>
        </Link>

        {/* 네비 항목 */}
        {hasStudy && (
          <ul className="hidden items-center gap-1.5 sm:flex" role="list">
            {NAV_LINKS.map(({ href, label }) => {
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
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {/* 모바일 햄버거 */}
        {hasStudy && (
          <button
            type="button"
            aria-label={mobileMenuOpen ? '메뉴 닫기' : '메뉴 열기'}
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

        {/* 우측 영역 */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {isAuthenticated && <StudySelector />}

          {/* 테마 토글 */}
          <button
            type="button"
            aria-label="테마 전환"
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
              로그인
            </Link>
          )}
        </div>
      </nav>

      {/* 모바일 드롭다운 */}
      {hasStudy && mobileMenuOpen && (
        <div className="border-t border-border px-4 py-2 sm:hidden">
          <ul className="flex flex-col gap-1" role="list">
            {NAV_LINKS.map(({ href, label }) => {
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
                    {label}
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
