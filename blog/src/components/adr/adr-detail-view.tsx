/**
 * @file       adr-detail-view.tsx
 * @domain     blog / adr
 * @layer      ui
 * @related    src/lib/adr/types.ts, adr-toc.tsx, adr-meta-sidebar.tsx
 *
 * ADR 상세 3-column 레이아웃 — 좌 TOC / 중앙 본문 / 우 메타사이드바(미니 그래프 포함).
 */
import type { AdjacencyList, AdrDoc } from '@/lib/adr/types';
import { renderAdrMdx } from '@/lib/adr/markdown';
import { AdrToc } from './adr-toc';
import { AdrMetaSidebar } from './adr-meta-sidebar';

interface AdrDetailViewProps {
  doc: AdrDoc;
  prevSprint?: number;
  nextSprint?: number;
  miniGraph?: AdjacencyList;
}

/** ADR 상세 3-column 레이아웃을 렌더링한다. */
export async function AdrDetailView({
  doc,
  prevSprint,
  nextSprint,
  miniGraph,
}: AdrDetailViewProps) {
  const content = await renderAdrMdx(doc.bodyMarkdown);

  return (
    <div className="flex gap-8">
      {/* 좌측 TOC */}
      <AdrToc sections={doc.sections} />

      {/* 중앙 본문 */}
      <article className="min-w-0 max-w-3xl flex-1">
        <h1 className="mb-6 text-3xl font-bold text-text">{doc.meta.title}</h1>
        <div className="prose max-w-none">{content}</div>
      </article>

      {/* 우측 메타사이드바 */}
      <AdrMetaSidebar
        doc={doc}
        prevSprint={prevSprint}
        nextSprint={nextSprint}
        miniGraph={miniGraph}
      />
    </div>
  );
}
