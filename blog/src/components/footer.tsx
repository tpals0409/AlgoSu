/**
 * @file       footer.tsx
 * @domain     blog
 * @layer      ui
 * @related    src/lib/i18n.ts, src/lib/site-content.ts, src/app/(ko)/layout.tsx,
 *             src/app/en/layout.tsx, src/app/(adr)/layout.tsx
 *
 * 사이트 공통 Footer — 브랜드 + 내부 네비(블로그/ADR/소개) + 외부 링크(GitHub/서비스) + 저작권.
 * (ko)·en·(adr) 레이아웃 3곳이 공유한다. (adr)는 ko/en 공통 레이아웃이라
 * locale을 prop으로 받을 수 없으므로, AdrHeader/LocaleToggle과 동일하게
 * pathname 기반으로 locale을 판별한다(Client Component).
 */
'use client';

import { usePathname } from 'next/navigation';
import type { Locale } from '@/lib/i18n';
import { getBasePath, t, tf } from '@/lib/i18n';
import { ALGOSU_SERVICE_URL, GITHUB_URL } from '@/lib/site-content';

/** pathname → locale 판별 ('en' 접두사 여부). */
function resolveLocale(pathname: string | null): Locale {
  return pathname?.startsWith('/en') ? 'en' : 'ko';
}

/** 공통 링크 hover 스타일. */
const LINK_CLASS = 'text-text-muted transition-colors hover:text-brand';

/** 사이트 공통 Footer를 렌더링한다. */
export function Footer() {
  const pathname = usePathname();
  const locale = resolveLocale(pathname);
  const basePath = getBasePath(locale);
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-4xl flex-col gap-4 px-6 py-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <a
            href={basePath || '/'}
            className="font-heading text-base font-bold tracking-tight text-brand"
          >
            AlgoSu Tech
          </a>
          <p className="text-xs text-text-subtle">{tf(locale, 'footerCopyright', { year })}</p>
        </div>

        <nav
          aria-label="Footer"
          className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-medium"
        >
          <a href={basePath || '/'} className={LINK_CLASS}>
            {t(locale, 'navBlog')}
          </a>
          <a href={`${basePath}/adr/`} className={LINK_CLASS}>
            {t(locale, 'navAdr')}
          </a>
          <a href={`${basePath}/about/`} className={LINK_CLASS}>
            {t(locale, 'navAbout')}
          </a>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1 ${LINK_CLASS}`}
          >
            GitHub
            <span aria-hidden>↗</span>
          </a>
          <a
            href={ALGOSU_SERVICE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1 ${LINK_CLASS}`}
          >
            {t(locale, 'footerService')}
            <span aria-hidden>↗</span>
          </a>
        </nav>
      </div>
    </footer>
  );
}
