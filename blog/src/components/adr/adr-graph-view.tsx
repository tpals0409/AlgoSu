/**
 * @file       adr-graph-view.tsx
 * @domain     blog / adr
 * @layer      ui
 * @related    related-adr-graph.tsx, src/lib/i18n.ts
 *
 * 전체 ADR 관계 그래프 페이지 본문 — 헤더 + 그래프 + 범례.
 * locale prop으로 KR/EN UI 토글.
 */
import type { AdjacencyList } from '@/lib/adr/types';
import { type Locale, t, tf } from '@/lib/i18n';
import { RelatedAdrGraph } from './related-adr-graph';

interface AdrGraphViewProps {
  adjacency: AdjacencyList;
  locale?: Locale;
}

/** 전체 ADR 관계 그래프 뷰를 렌더링한다. */
export function AdrGraphView({ adjacency, locale = 'ko' }: AdrGraphViewProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text">
          {t(locale, 'graphPageTitle')}
        </h1>
        <p className="text-sm text-text-muted">
          {tf(locale, 'graphNodeCount', { n: adjacency.nodes.length })}
          {' · '}
          {tf(locale, 'graphEdgeCount', { n: adjacency.edges.length })}
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface-elevated p-4">
        <RelatedAdrGraph
          adjacency={adjacency}
          caption={t(locale, 'graphCaption')}
          locale={locale}
        />
      </div>

      {/* 범례 */}
      <div className="flex items-center gap-6 text-xs text-text-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-6 rounded border border-border bg-surface" />
          {t(locale, 'graphNodeNormal')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-6 rounded bg-brand" />
          {t(locale, 'graphNodeHighlight')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-px w-6 border-t-2 border-solid border-text-muted" />
          {t(locale, 'graphEdgeResolved')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-px w-6 border-t-2 border-dashed border-text-muted" />
          {t(locale, 'graphEdgeUnresolved')}
        </span>
      </div>
    </div>
  );
}
