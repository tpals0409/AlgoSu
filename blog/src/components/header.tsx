/**
 * @file       header.tsx
 * @domain     blog
 * @layer      ui
 * @related    src/components/locale-toggle.tsx, src/components/theme-toggle.tsx
 *
 * 사이트 공통 헤더 — 브랜드 링크, 언어 토글, 테마 토글을 포함한다.
 * Client Component(LocaleToggle, ThemeToggle)를 자식으로 포함하므로
 * 자체도 Client Component로 선언한다.
 */
'use client';

import type { Locale } from '@/lib/i18n';
import { getBasePath } from '@/lib/i18n';
import { LocaleToggle } from '@/components/locale-toggle';
import { ThemeToggle } from '@/components/theme-toggle';

interface HeaderProps {
  locale: Locale;
}

/** 사이트 글로벌 헤더를 렌더링한다. */
export function Header({ locale }: HeaderProps) {
  const brandHref = getBasePath(locale) || '/';

  return (
    <header className="border-b border-border">
      <nav className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
        <a href={brandHref} className="text-xl font-bold text-brand">
          AlgoSu Tech
        </a>
        <div className="flex items-center gap-2">
          <LocaleToggle />
          <ThemeToggle locale={locale} />
        </div>
      </nav>
    </header>
  );
}
