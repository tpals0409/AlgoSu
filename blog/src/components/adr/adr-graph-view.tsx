/**
 * @file       adr-graph-view.tsx
 * @domain     blog / adr
 * @layer      ui
 * @related    related-adr-graph.tsx, src/lib/i18n.ts, src/lib/adr/index-builder.ts
 *
 * 전체 ADR 관계 그래프 페이지 본문 — 헤더 + 필터 + 그래프 + 범례.
 * 클라이언트 컴포넌트: useState로 필터 상태(노드 종류·엣지 표시)를 관리한다.
 * locale prop으로 KR/EN UI 토글.
 */
'use client';

import { useMemo, useState } from 'react';
import type { AdjacencyList, AdrKind } from '@/lib/adr/types';
import { filterAdjacency } from '@/lib/adr/index-builder';
import { type Locale, t, tf } from '@/lib/i18n';
import { KIND_COLORS, RelatedAdrGraph } from './related-adr-graph';

/* ─── 상수 ──────────────────────────────────────── */

const ALL_KINDS: AdrKind[] = ['permanent', 'sprint', 'topic'];

/** kind별 i18n 라벨 키 매핑 */
const KIND_LABEL_KEYS: Record<AdrKind, 'graphKindPermanent' | 'graphKindSprint' | 'graphKindTopic'> = {
  permanent: 'graphKindPermanent',
  sprint: 'graphKindSprint',
  topic: 'graphKindTopic',
};

/* ─── Props ─────────────────────────────────────── */

interface AdrGraphViewProps {
  adjacency: AdjacencyList;
  locale?: Locale;
}

/* ─── 컴포넌트 ──────────────────────────────────── */

/** 전체 ADR 관계 그래프 뷰를 렌더링한다. */
export function AdrGraphView({ adjacency, locale = 'ko' }: AdrGraphViewProps) {
  /* 필터 상태 */
  const [activeKinds, setActiveKinds] = useState<Set<AdrKind>>(
    () => new Set(ALL_KINDS),
  );
  const [showEdges, setShowEdges] = useState(true);

  /* 필터 적용 — kinds/edge 상태 변경 시 재계산 */
  const filtered = useMemo(
    () => filterAdjacency(adjacency, { kinds: activeKinds, showEdges }),
    [adjacency, activeKinds, showEdges],
  );

  /** kind 토글 핸들러 */
  function toggleKind(kind: AdrKind) {
    setActiveKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) {
        next.delete(kind);
      } else {
        next.add(kind);
      }
      return next;
    });
  }

  return (
    <div className="space-y-6">
      {/* 헤더 — 제목 + 필터 후 카운트 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text">
          {t(locale, 'graphPageTitle')}
        </h1>
        <p className="text-sm text-text-muted">
          {tf(locale, 'graphNodeCount', { n: filtered.nodes.length })}
          {' · '}
          {tf(locale, 'graphEdgeCount', { n: filtered.edges.length })}
        </p>
      </div>

      {/* 필터 컨트롤 */}
      <FilterControls
        locale={locale}
        activeKinds={activeKinds}
        showEdges={showEdges}
        onToggleKind={toggleKind}
        onToggleEdges={() => setShowEdges((v) => !v)}
      />

      {/* 그래프 */}
      <div className="rounded-xl border border-border bg-surface-elevated p-4">
        <RelatedAdrGraph
          adjacency={filtered}
          caption={t(locale, 'graphCaption')}
          locale={locale}
        />
      </div>

      {/* 범례 */}
      <GraphLegend locale={locale} />
    </div>
  );
}

/* ─── 필터 컨트롤 ────────────────────────────────── */

interface FilterControlsProps {
  locale: Locale;
  activeKinds: Set<AdrKind>;
  showEdges: boolean;
  onToggleKind: (kind: AdrKind) => void;
  onToggleEdges: () => void;
}

/** 노드 종류·엣지 표시 토글 필터 UI */
function FilterControls({
  locale,
  activeKinds,
  showEdges,
  onToggleKind,
  onToggleEdges,
}: FilterControlsProps) {
  return (
    <div className="flex flex-wrap items-start gap-6 rounded-lg border border-border bg-surface-muted px-4 py-3">
      {/* 노드 종류 필터 */}
      <div className="space-y-1.5">
        <span className="text-xs font-medium text-text-muted">
          {t(locale, 'graphFilterKindLabel')}
        </span>
        <div className="flex gap-2">
          {ALL_KINDS.map((kind) => {
            const active = activeKinds.has(kind);
            const kc = KIND_COLORS[kind];
            return (
              <button
                key={kind}
                type="button"
                role="checkbox"
                aria-checked={active}
                aria-label={t(locale, KIND_LABEL_KEYS[kind])}
                onClick={() => onToggleKind(kind)}
                className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                  active
                    ? 'border-border-strong bg-surface-elevated text-text shadow-sm'
                    : 'border-border bg-surface text-text-subtle opacity-60'
                }`}
              >
                {/* kind 색상 스와치 */}
                <span
                  className="inline-block h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: kc?.fill }}
                  aria-hidden="true"
                />
                {t(locale, KIND_LABEL_KEYS[kind])}
              </button>
            );
          })}
        </div>
      </div>

      {/* 엣지 표시 필터 */}
      <div className="space-y-1.5">
        <span className="text-xs font-medium text-text-muted">
          {t(locale, 'graphFilterEdgeLabel')}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            role="checkbox"
            aria-checked={showEdges}
            aria-label={t(locale, 'graphEdgeShow')}
            onClick={onToggleEdges}
            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
              showEdges
                ? 'border-border-strong bg-surface-elevated text-text shadow-sm'
                : 'border-border bg-surface text-text-subtle opacity-60'
            }`}
          >
            <span className="inline-block h-px w-4 border-t-2 border-solid border-text-muted" aria-hidden="true" />
            {t(locale, 'graphEdgeShow')}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── 범례 ───────────────────────────────────────── */

/** 그래프 범례 — kind 색상 스와치 + 엣지 실선 + 의미 설명 */
function GraphLegend({ locale }: { locale: Locale }) {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface-muted px-4 py-3">
      <h2 className="text-xs font-semibold text-text">
        {t(locale, 'graphLegendTitle')}
      </h2>

      {/* 노드 종류별 색상 */}
      <div className="flex flex-wrap items-center gap-5 text-xs text-text-muted">
        {ALL_KINDS.map((kind) => {
          const kc = KIND_COLORS[kind];
          return (
            <span key={kind} className="flex items-center gap-1.5">
              <span
                className="inline-block h-3 w-6 rounded"
                style={{ backgroundColor: kc?.fill }}
                aria-hidden="true"
              />
              {t(locale, KIND_LABEL_KEYS[kind])}
            </span>
          );
        })}

        {/* 강조 노드 */}
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-6 rounded bg-brand-strong" aria-hidden="true" />
          {t(locale, 'graphNodeHighlight')}
        </span>
      </div>

      {/* 엣지 유형 */}
      <div className="flex flex-wrap items-center gap-5 text-xs text-text-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-px w-6 border-t-2 border-solid border-text-muted" aria-hidden="true" />
          {t(locale, 'graphEdgeShow')}
        </span>
      </div>

      {/* 의미 설명 */}
      <div className="space-y-0.5 text-xs text-text-subtle">
        <p>{t(locale, 'graphNodeMeaning')}</p>
        <p>{t(locale, 'graphEdgeMeaning')}</p>
      </div>
    </div>
  );
}
