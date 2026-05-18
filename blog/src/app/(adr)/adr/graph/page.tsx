/**
 * @file       page.tsx
 * @domain     blog / adr
 * @layer      app
 * @related    src/lib/adr/loader.ts, src/components/adr/related-adr-graph.tsx
 *
 * ADR 그래프 풀스크린 페이지 — /adr/graph/ 경로.
 * 서버에서 AdjacencyList를 빌드하여 클라이언트 그래프로 전달한다.
 */
import { getAllAdrs } from '@/lib/adr/loader';
import { buildAdrIndex } from '@/lib/adr/index-builder';
import { RelatedAdrGraph } from '@/components/adr/related-adr-graph';

/** 그래프 페이지 메타데이터를 생성한다. */
export function generateMetadata() {
  return {
    title: 'ADR 관계 그래프 — AlgoSu',
    description: 'ADR 간의 관계를 시각화한 그래프.',
  };
}

/** ADR 그래프 풀스크린 페이지를 렌더링한다. */
export default function AdrGraphPage() {
  const docs = getAllAdrs();
  const index = buildAdrIndex(docs);
  const adjacency = index.graph;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text">
          ADR 관계 그래프
        </h1>
        <p className="text-sm text-text-muted">
          {adjacency.nodes.length}개 노드 &middot;{' '}
          {adjacency.edges.length}개 연결
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface-elevated p-4">
        <RelatedAdrGraph
          adjacency={adjacency}
          caption="전체 ADR 관계 그래프 — 점선은 미확인(unresolved) 연결"
        />
      </div>

      {/* 범례 */}
      <div className="flex items-center gap-6 text-xs text-text-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-6 rounded border border-border bg-surface" />
          일반 노드
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-6 rounded bg-brand" />
          강조 노드
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-px w-6 border-t-2 border-solid border-text-muted" />
          확인된 연결
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-px w-6 border-t-2 border-dashed border-text-muted" />
          미확인 연결
        </span>
      </div>
    </div>
  );
}
