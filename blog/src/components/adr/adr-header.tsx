/**
 * @file       adr-header.tsx
 * @domain     blog / adr
 * @layer      ui
 * @related    src/app/(adr)/layout.tsx, src/components/adr/search-box.tsx, src/components/locale-toggle.tsx
 *
 * ADR 사이트 전용 헤더 — 브랜드 링크, Graph 링크, SearchBox, Blog 링크, LocaleToggle.
 * 현재 pathname이 `/en`으로 시작하면 ADR 사이트의 locale을 'en'으로 판별한다.
 * locale에 따라 모든 네비게이션 링크 prefix를 자동 조정한다.
 */
'use client';

import { usePathname } from 'next/navigation';
import type { Locale } from '@/lib/i18n';
import { t } from '@/lib/i18n';
import { SearchBox } from '@/components/adr/search-box';
import { LocaleToggle } from '@/components/locale-toggle';

/** pathname → locale 판별 ('en' 접두사 여부). */
function resolveLocale(pathname: string | null): Locale {
  return pathname?.startsWith('/en') ? 'en' : 'ko';
}

/** ADR 헤더를 렌더링한다. */
export function AdrHeader() {
  const pathname = usePathname();
  const locale = resolveLocale(pathname);
  const prefix = locale === 'en' ? '/en' : '';

  const homeHref = `${prefix}/adr/`;
  const graphHref = `${prefix}/adr/graph/`;
  const blogHref = `${prefix}/` || '/';

  return (
    <header className="border-b border-border">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          <a href={homeHref} className="text-lg font-bold text-brand">
            {t(locale, 'adrTitle')}
          </a>
          <a
            href={graphHref}
            className="hidden text-sm text-text-muted transition-colors hover:text-brand sm:inline"
          >
            {t(locale, 'navGraph')}
          </a>
        </div>
        <div className="flex items-center gap-4">
          <SearchBox />
          <a
            href={blogHref}
            className="text-sm text-text-muted transition-colors hover:text-brand"
          >
            {t(locale, 'navBlog')}
          </a>
          <LocaleToggle />
        </div>
      </nav>
    </header>
  );
}
