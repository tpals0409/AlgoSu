'use client';

import type { ReactNode } from 'react';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Sun, Moon, ChevronDown, Menu, X } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useStudy } from '@/contexts/StudyContext';
import { NotificationBell } from '@/components/layout/NotificationBell';

/**
 * TopNav — AlgoSu UI Design System
 *
 * 목업 navbar 스펙:
 *  전체: sticky top-0 z-50; border-bottom 1px solid border;
 *        light bg rgba(255,255,255,0.85) / dark bg rgba(35,31,52,0.88) — glass-dark 참조
 *        backdrop-filter blur(8px)
 *  내부: max-w-screen-xl mx-auto; padding 12px 20px;
 *        display flex; align-items center; justify-content space-between;
 *
 *  로고: font-size 16px; font-weight 700; letter-spacing -0.5px;
 *        dot: 8x8px circle; bg --color-main
 *
 *  nav-item: padding 5px 12px; border-radius 6px; font-size 12px; font-weight 500
 *    inactive: color text2; hover bg bg2
 *    active light: bg primary-100(#EBE4F6); color primary-700(#6D5A8A)
 *    active dark:  bg primary-900(#302846); color primary-300(#B9A9D0)
 *
 *  우측:
 *    bell: 28x28px; border-radius 6px; bg bg2
 *    avatar: 28x28px circle; gradient 135deg --color-main -> --color-sub
 *            font-size 11px; font-weight 600; color white
 *    로그인버튼(미인증): primary 스타일 sm 사이즈
 */

const NAV_LINKS = [
  { href: '/dashboard', label: '대시보드' },
  { href: '/problems', label: '문제' },
  { href: '/submissions', label: '제출' },
] as const;

function getInitials(email?: string | null): string {
  const src = email ?? '';
  return src.slice(0, 2).toUpperCase();
}

function StudySelector(): ReactNode {
  const router = useRouter();
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
        className="inline-flex items-center gap-1 rounded-btn bg-bg2 px-2.5 py-1 text-[11px] font-medium text-text2 hover:text-foreground"
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
        className="inline-flex items-center gap-1 rounded-btn bg-bg2 px-2.5 py-1 text-[11px] font-medium text-text2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="max-w-[80px] truncate">
          {currentStudy?.name ?? '스터디 선택'}
        </span>
        <ChevronDown className="h-3 w-3 shrink-0" aria-hidden />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="스터디 목록"
          className="absolute left-0 top-full z-50 mt-1 min-w-[140px] overflow-hidden rounded-card border border-border bg-surface shadow-card"
        >
          {studies.map((study) => (
            <button
              key={study.id}
              role="option"
              aria-selected={study.id === currentStudyId}
              type="button"
              className={cn(
                'flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] transition-colors',
                study.id === currentStudyId
                  ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                  : 'text-text1 hover:bg-bg2',
              )}
              onClick={() => {
                setCurrentStudy(study.id);
                setOpen(false);
              }}
            >
              <span className="truncate">{study.name}</span>
            </button>
          ))}
          <div className="border-t border-border">
            <button
              type="button"
              className="flex w-full items-center px-3 py-2 text-left text-[12px] text-text2 hover:bg-bg2"
              onClick={() => {
                setOpen(false);
                router.push('/studies');
              }}
            >
              모든 스터디 보기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function TopNav(): ReactNode {
  const pathname = usePathname();
  const { user, isAuthenticated } = useAuth();
  const { currentStudyId } = useStudy();
  const { theme, setTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const hasStudy = isAuthenticated && currentStudyId !== null;

  // 모바일 메뉴 오픈 시 배경 스크롤 방지
  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  return (
    <header
      className={cn(
        'sticky top-0 z-50 border-b border-border',
        'glass-light dark:glass-dark',
      )}
    >
      <nav
        className="mx-auto flex max-w-screen-xl items-center justify-between"
        style={{ padding: '12px 20px' }}
        aria-label="주 내비게이션"
      >
        {/* 로고 */}
        <Link
          href="/"
          className="flex items-center gap-1.5 text-foreground transition-opacity hover:opacity-80"
          style={{ fontWeight: 700, fontSize: '16px', letterSpacing: '-0.5px' }}
        >
          <span
            className="shrink-0 rounded-full bg-primary-500"
            style={{ width: '8px', height: '8px' }}
            aria-hidden
          />
          AlgoSu
        </Link>

        {/* 네비 항목 — 로그인 + 스터디 참여 시에만 노출 */}
        {hasStudy && (
          <ul className="hidden items-center gap-1.5 sm:flex" role="list">
            {NAV_LINKS.map(({ href, label }) => {
              const isActive = pathname === href || pathname.startsWith(href + '/');
              return (
                <li key={href}>
                  <Link
                    href={href}
                    className={cn(
                      'inline-block transition-colors duration-150',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      isActive
                        ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                        : 'text-text2 hover:bg-bg2 hover:text-foreground',
                    )}
                    style={{
                      padding: '5px 12px',
                      fontSize: '12px',
                      fontWeight: 500,
                      borderRadius: '6px',
                    }}
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {/* 모바일 햄버거 (M6) */}
        {hasStudy && (
          <button
            type="button"
            aria-label="메뉴 열기"
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="flex items-center justify-center bg-bg2 text-muted-foreground hover:text-foreground sm:hidden"
            style={{ width: '28px', height: '28px', borderRadius: '6px' }}
          >
            {mobileMenuOpen ? (
              <X className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <Menu className="h-3.5 w-3.5" aria-hidden />
            )}
          </button>
        )}

        {/* 우측 영역 */}
        <div className="flex items-center gap-2">
          {/* 스터디 전환 (인증 상태에서만 표시) */}
          {isAuthenticated && <StudySelector />}

          {/* 테마 토글 */}
          <button
            type="button"
            aria-label="테마 전환"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className={cn(
              'relative flex items-center justify-center bg-bg2',
              'text-muted-foreground transition-colors',
              'hover:text-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
            style={{ width: '28px', height: '28px', borderRadius: '6px' }}
          >
            <Sun className="h-3.5 w-3.5 dark:hidden" aria-hidden />
            <Moon className="hidden h-3.5 w-3.5 dark:block" aria-hidden />
          </button>

          {isAuthenticated ? (
            <>
              {/* 알림 벨 */}
              <NotificationBell />

              {/* 아바타 (프로필 링크) */}
              <Link
                href="/profile"
                className="flex shrink-0 items-center justify-center rounded-full text-white transition-opacity hover:opacity-80"
                style={{
                  width: '28px',
                  height: '28px',
                  background: 'linear-gradient(135deg, var(--color-main), var(--color-sub))',
                  fontSize: '11px',
                  fontWeight: 600,
                }}
                aria-label={`${user?.email ?? ''} 프로필`}
              >
                {getInitials(user?.email)}
              </Link>
            </>
          ) : (
            <Link
              href="/login"
              className={cn(
                'inline-flex items-center justify-center',
                'bg-primary-500 text-white',
                'transition-colors hover:bg-primary-400',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
              style={{
                padding: '5px 10px',
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.2px',
                borderRadius: '6px',
              }}
            >
              로그인
            </Link>
          )}
        </div>
      </nav>

      {/* 모바일 드롭다운 메뉴 (M6) */}
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
                      'block transition-colors duration-150',
                      isActive
                        ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                        : 'text-text2 hover:bg-bg2 hover:text-foreground',
                    )}
                    style={{
                      padding: '8px 12px',
                      fontSize: '13px',
                      fontWeight: 500,
                      borderRadius: '6px',
                    }}
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
