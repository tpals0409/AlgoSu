/**
 * @file       header.tsx
 * @domain     blog
 * @layer      ui
 * @related    src/components/locale-toggle.tsx
 *
 * 사이트 공통 헤더 — 브랜드 링크, 언어 토글을 포함한다.
 * Client Component(LocaleToggle)를 자식으로 포함하므로
 * 자체도 Client Component로 선언한다.
 */
'use client';

import type { Locale } from '@/lib/i18n';
import { getBasePath, t } from '@/lib/i18n';
import { LocaleToggle } from '@/components/locale-toggle';

interface HeaderProps {
  locale: Locale;
}

/**
 * 사이트 글로벌 헤더를 렌더링한다.
 *
 * 우측 네비:
 *  - ADR 진입 링크 (`/adr/` for ko, `/en/adr/` for en, Sprint 157)
 *  - About 진입 링크 (`/about/`, Sprint 188)
 *  - LocaleToggle
 */
export function Header({ locale }: HeaderProps) {
  const brandHref = getBasePath(locale) || '/';
  const adrHref = `${getBasePath(locale)}/adr/`;
  const aboutHref = `${getBasePath(locale)}/about/`;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-[color-mix(in_srgb,var(--surface)_80%,transparent)] backdrop-blur-md">
      <nav className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
        <a
          href={brandHref}
          className="group inline-flex items-center gap-2 font-heading text-base font-bold tracking-tight text-text transition-colors hover:text-brand sm:text-lg"
        >
          <span
            className="h-4 w-1 rounded-full bg-brand transition-all group-hover:h-5"
            aria-hidden
          />
          AlgoSu&nbsp;<span className="text-brand">Tech</span>
        </a>
        <div className="flex items-center gap-1 sm:gap-2">
          <a
            href={adrHref}
            className="rounded-full px-2.5 py-1.5 text-sm font-medium text-text-muted transition-colors hover:bg-brand-soft hover:text-brand sm:px-3"
          >
            {t(locale, 'navAdr')}
          </a>
          <a
            href={aboutHref}
            className="rounded-full px-2.5 py-1.5 text-sm font-medium text-text-muted transition-colors hover:bg-brand-soft hover:text-brand sm:px-3"
          >
            {t(locale, 'navAbout')}
          </a>
          <span className="mx-1 h-4 w-px bg-border" aria-hidden />
          <LocaleToggle />
        </div>
      </nav>
    </header>
  );
}
