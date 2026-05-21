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
    <header className="border-b border-border">
      <nav className="mx-auto flex max-w-4xl items-center justify-between px-6 py-6">
        <a href={brandHref} className="font-heading text-xl font-bold tracking-tight text-brand">
          AlgoSu Tech
        </a>
        <div className="flex items-center gap-5">
          <a
            href={adrHref}
            className="text-sm font-medium text-text-muted hover:text-brand"
          >
            {t(locale, 'navAdr')}
          </a>
          <a
            href={aboutHref}
            className="text-sm font-medium text-text-muted hover:text-brand"
          >
            {t(locale, 'navAbout')}
          </a>
          <LocaleToggle />
        </div>
      </nav>
    </header>
  );
}
