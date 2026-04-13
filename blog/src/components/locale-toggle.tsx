/**
 * @file       locale-toggle.tsx
 * @domain     blog
 * @layer      ui
 * @related    src/lib/i18n.ts, src/components/header.tsx
 *
 * 현재 경로 기반 ko/en 언어 전환 링크.
 * pathname이 /en으로 시작하면 현재 locale을 en으로 판별하고,
 * 그 외는 ko로 판별하여 반대 locale 경로를 링크한다.
 */
'use client';

import { usePathname } from 'next/navigation';

/** 현재 경로를 기반으로 반대 locale 링크를 렌더링한다. */
export function LocaleToggle() {
  const pathname = usePathname();
  const isEn = pathname.startsWith('/en');

  const targetHref = isEn
    ? pathname.replace(/^\/en/, '') || '/'
    : `/en${pathname}`;
  const targetLabel = isEn ? 'KO' : 'EN';

  return (
    <a
      href={targetHref}
      aria-label={isEn ? '한국어로 전환' : 'Switch to English'}
      title={isEn ? '한국어로 전환' : 'Switch to English'}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-xs font-bold text-text-muted hover:text-brand"
    >
      {targetLabel}
    </a>
  );
}
