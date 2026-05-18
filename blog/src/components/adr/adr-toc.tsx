/**
 * @file       adr-toc.tsx
 * @domain     blog / adr
 * @layer      ui
 * @related    src/lib/adr/types.ts
 *
 * 상세 페이지 좌측 TOC — H2/H3 들여쓰기, anchor 링크.
 * CSS scroll-margin + anchor 기반 하이라이트 (JS 없음).
 */
import type { AdrSection } from '@/lib/adr/types';

interface AdrTocProps {
  sections: AdrSection[];
}

/** 단일 TOC 항목을 렌더링한다. */
function TocItem({ section }: { section: AdrSection }) {
  const indent = section.level === 3 ? 'pl-4' : '';

  return (
    <li>
      <a
        href={`#${section.anchorId}`}
        className={`block truncate py-1 text-sm text-text-muted transition-colors hover:text-brand ${indent}`}
      >
        {section.heading}
      </a>
    </li>
  );
}

/** ADR 섹션 목차를 렌더링한다. */
export function AdrToc({ sections }: AdrTocProps) {
  if (sections.length === 0) return null;

  return (
    <nav
      aria-label="목차"
      className="sticky top-24 hidden max-h-[calc(100vh-8rem)] w-60 overflow-y-auto lg:block"
    >
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-subtle">
        목차
      </h4>
      <ul className="space-y-0.5 border-l border-border pl-3">
        {sections.map((s) => (
          <TocItem key={s.anchorId} section={s} />
        ))}
      </ul>
    </nav>
  );
}
