/**
 * @file       sidebar.tsx
 * @domain     blog
 * @layer      ui
 * @related    src/components/locale-toggle.tsx, src/lib/i18n.ts,
 *             src/app/(ko)/layout.tsx, src/app/en/layout.tsx, src/app/(adr)/layout.tsx
 *
 * 글로벌 좌측 persistent 사이드바 (Signal Grid 3존 셸의 좌측 존).
 * - 데스크톱(lg+): 좌측 고정(sticky) 240px 사이드바. 브랜드 + 섹션 트리 + LocaleToggle.
 * - 모바일(<lg): 사이드바 숨김 → 컴팩트 상단바(햄버거) + off-canvas 드로어.
 *   useState 토글, ESC/오버레이 클릭 닫기, aria-expanded/aria-label 접근성.
 * - 활성 링크는 usePathname()으로 판별.
 *
 * (adr) 레이아웃은 locale prop을 받을 수 없으므로 pathname 기반으로 locale을 판별한다.
 * ko/en 링크는 getBasePath(locale)로 생성한다 (ADR: ko=`/adr/...`, en=`/en/adr/...`).
 */
'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { Locale } from '@/lib/i18n';
import { getBasePath, t } from '@/lib/i18n';
import { LocaleToggle } from '@/components/locale-toggle';

/** 사이드바 네비 항목. */
interface NavItem {
  /** 표시 라벨. */
  label: string;
  /** locale 프리픽스가 반영된 절대 경로(trailing slash 포함). */
  href: string;
  /** 하위(중첩) 항목 — ADR 섹션 등. */
  children?: NavItem[];
}

/** pathname 접두사로 locale을 판별한다. (adr) 공통 레이아웃 대응. */
function resolveLocale(pathname: string | null): Locale {
  return pathname?.startsWith('/en') ? 'en' : 'ko';
}

/**
 * locale에 맞춰 사이드바 섹션 트리를 구성한다.
 *
 * - Home / Posts: 홈(`/` 또는 `/en/`) 기준.
 * - ADR: Landing·Sprints·Topics·Permanent·Archive (ko=`/adr/...`, en=`/en/adr/...`).
 * - About: `/about/`.
 */
function buildNav(locale: Locale): NavItem[] {
  const base = getBasePath(locale);
  const home = `${base}/` || '/';
  const adr = `${base}/adr`;

  // Home = 글(Posts) 인덱스 (별도 /posts landing 부재). ADR 하위 5종 + About.
  return [
    { label: t(locale, 'blogHome'), href: home },
    {
      label: t(locale, 'navAdr'),
      href: `${adr}/`,
      children: [
        { label: t(locale, 'adrTitle'), href: `${adr}/` },
        { label: t(locale, 'sectionSprint'), href: `${adr}/sprints/` },
        { label: t(locale, 'sectionTopic'), href: `${adr}/topics/` },
        { label: t(locale, 'sectionPermanent'), href: `${adr}/permanent/` },
        { label: t(locale, 'adrArchiveTitle'), href: `${adr}/archive/` },
      ],
    },
    { label: t(locale, 'navAbout'), href: `${base}/about/` },
  ];
}

/**
 * 현재 경로가 항목과 일치하는지 판별한다.
 * 홈(`/`,`/en/`)은 정확히 일치할 때만 활성(다른 경로의 접두사가 되지 않도록).
 * 그 외는 정확 일치 또는 하위 경로일 때 활성.
 */
function isActive(pathname: string, href: string): boolean {
  const current = pathname.endsWith('/') ? pathname : `${pathname}/`;
  const target = href.endsWith('/') ? href : `${href}/`;
  if (target === '/' || target === '/en/') {
    return current === target;
  }
  return current === target || current.startsWith(target);
}

/** 브랜드 로고 블록 — 헤더의 "AlgoSu Tech" 브랜드. */
function Brand({ href, onNavigate }: { href: string; onNavigate?: () => void }) {
  return (
    <a
      href={href}
      onClick={onNavigate}
      className="group inline-flex items-center gap-2 font-heading text-base font-bold tracking-tight text-text transition-colors hover:text-brand sm:text-lg"
    >
      <span
        className="h-4 w-1 rounded-full bg-brand transition-all group-hover:h-5"
        aria-hidden
      />
      AlgoSu&nbsp;<span className="text-brand">Tech</span>
    </a>
  );
}

/** 단일 링크 렌더 — 활성 하이라이트 포함. child 여부에 따라 들여쓰기/크기 조정. */
function NavLink({
  item,
  pathname,
  depth,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  depth: number;
  onNavigate?: () => void;
}) {
  const active = isActive(pathname, item.href);
  const base =
    'block rounded-md px-3 py-1.5 text-sm font-medium transition-colors';
  const state = active
    ? 'bg-brand-soft text-brand'
    : 'text-text-muted hover:bg-brand-soft hover:text-brand';
  const indent = depth > 0 ? 'ml-3 text-[0.8125rem]' : '';

  return (
    <a
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={`${base} ${state} ${indent}`.trim()}
    >
      {item.label}
    </a>
  );
}

/** 섹션 트리 네비 본문 — 데스크톱/드로어 공유. */
function NavTree({
  items,
  pathname,
  onNavigate,
}: {
  items: NavItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Site" className="flex flex-col gap-0.5">
      {items.map((item) => (
        <div key={item.href} className="flex flex-col gap-0.5">
          <NavLink
            item={item}
            pathname={pathname}
            depth={0}
            onNavigate={onNavigate}
          />
          {item.children ? (
            <div className="mb-1 flex flex-col gap-0.5 border-l border-border pl-1">
              {item.children.map((child) => (
                <NavLink
                  key={child.href}
                  item={child}
                  pathname={pathname}
                  depth={1}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </nav>
  );
}

/**
 * 글로벌 사이드바 셸.
 *
 * 데스크톱: 좌측 sticky 사이드바(폭 --sidebar-width).
 * 모바일: 상단바(햄버거) + 드로어. 두 뷰가 같은 트리를 공유해 중복 네비를 만들지 않는다.
 */
export function Sidebar() {
  const pathname = usePathname() ?? '/';
  const locale = resolveLocale(pathname);
  const items = buildNav(locale);
  const brandHref = getBasePath(locale) || '/';
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);

  // ESC로 드로어 닫기 + 열려 있을 때 배경 스크롤 잠금.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  // 경로 변경 시 드로어 자동 닫힘.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      {/* ── 데스크톱: 좌측 고정 사이드바 (lg+) ────────────────── */}
      <aside
        className="fixed inset-y-0 left-0 z-30 hidden w-[var(--sidebar-width)] flex-col border-r border-border bg-surface-elevated px-4 py-6 lg:flex"
        aria-label="Sidebar"
      >
        <div className="mb-6">
          <Brand href={brandHref} />
        </div>
        <div className="flex-1 overflow-y-auto">
          <NavTree items={items} pathname={pathname} />
        </div>
        <div className="mt-4 border-t border-border pt-4">
          <LocaleToggle />
        </div>
      </aside>

      {/* ── 모바일: 컴팩트 상단바 (＜lg) ──────────────────────── */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-[color-mix(in_srgb,var(--surface)_80%,transparent)] px-4 py-3 backdrop-blur-md lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={locale === 'en' ? 'Open menu' : '메뉴 열기'}
          aria-expanded={open}
          aria-controls="mobile-drawer"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-text-muted transition-colors hover:bg-brand-soft hover:text-brand"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <Brand href={brandHref} />
        <LocaleToggle />
      </header>

      {/* ── 모바일 드로어(off-canvas) + 오버레이 ──────────────── */}
      {open ? (
        <div className="lg:hidden">
          <div
            className="fixed inset-0 z-40 bg-[color-mix(in_srgb,var(--text)_40%,transparent)]"
            onClick={close}
            aria-hidden
          />
          <aside
            id="mobile-drawer"
            className="fixed inset-y-0 left-0 z-50 flex w-[min(18rem,85vw)] flex-col border-r border-border bg-surface-elevated px-4 py-6 shadow-lift"
            aria-label="Sidebar"
          >
            <div className="mb-6 flex items-center justify-between">
              <Brand href={brandHref} onNavigate={close} />
              <button
                type="button"
                onClick={close}
                aria-label={locale === 'en' ? 'Close menu' : '메뉴 닫기'}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-text-muted transition-colors hover:bg-brand-soft hover:text-brand"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden
                >
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="18" y1="6" x2="6" y2="18" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <NavTree items={items} pathname={pathname} onNavigate={close} />
            </div>
            <div className="mt-4 border-t border-border pt-4">
              <LocaleToggle />
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
