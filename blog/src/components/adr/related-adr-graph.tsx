/**
 * @file       related-adr-graph.tsx
 * @domain     blog / adr
 * @layer      ui
 * @related    src/lib/adr/types.ts, src/components/blog/mermaid.tsx, src/lib/i18n.ts
 *
 * Related ADR 그래프 — AdjacencyList를 mermaid graph LR로 시각화한다.
 * 별도 mermaid 인스턴스(securityLevel:loose)를 사용하여 기존 blog mermaid에 영향 없음.
 * focusId 노드 강조 + resolved=false edge 점선 표시.
 * locale prop으로 노드 링크 prefix 토글.
 */
'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { Locale } from '@/lib/i18n';

/* ─── 타입 ──────────────────────────────────────── */

interface GraphNode {
  id: string;
  label: string;
  kind: string;
  sprint?: number;
}

interface GraphEdge {
  from: string;
  to: string;
  resolved: boolean;
}

interface AdjacencyList {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface RelatedAdrGraphProps {
  adjacency: AdjacencyList;
  focusId?: string;
  caption?: string;
  locale?: Locale;
}

/* ─── 노드 종류별 색상 (Engineering Editorial 토큰 유래) ─── */

/**
 * 노드 kind별 mermaid fill/text/stroke 색상 상수.
 *
 * mermaid `style` 디렉티브는 CSS variable이 아닌 리터럴 hex만 지원하므로
 * JS 상수로 정의하되, 각 값은 Engineering Editorial 토큰에서 유래한다.
 *
 * WCAG AA 텍스트 대비(4.5:1+, 흰 텍스트 #fff 고정):
 *   permanent — fill #2347e6 (brand cobalt), 흰 텍스트 대비 6.75:1 ✓
 *   sprint    — fill #0e7490 (cyan-700, --accent-2에서 WCAG AA 4.5:1 위해 darken), 흰 텍스트 대비 5.35:1 ✓
 *   topic     — fill #7c3aed (violet-600, --accent-6에서 WCAG AA 4.5:1 위해 darken), 흰 텍스트 대비 5.71:1 ✓
 */
export const KIND_COLORS: Record<string, { fill: string; color: string; stroke: string }> = {
  /** brand cobalt — globals.css --brand (#2347e6), 흰 텍스트 대비 6.75:1 */
  permanent: { fill: '#2347e6', color: '#ffffff', stroke: '#1b37b8' },
  /** cyan-700 — globals.css --accent-2에서 WCAG AA 위해 darken (#0e7490), 흰 텍스트 대비 5.35:1 */
  sprint:    { fill: '#0e7490', color: '#ffffff', stroke: '#155e75' },
  /** violet-600 — globals.css --accent-6에서 WCAG AA 위해 darken (#7c3aed), 흰 텍스트 대비 5.71:1 */
  topic:     { fill: '#7c3aed', color: '#ffffff', stroke: '#6d28d9' },
} as const;

/** focus 노드 강조 — brand cobalt (기존 #715DA8 → brand 정렬) */
const FOCUS_STYLE = { fill: '#1b37b8', color: '#ffffff', stroke: '#152a8a' };

/* ─── 노드 라벨 ─────────────────────────────────── */

/** 노드 ID에서 짧은 라벨을 생성한다. */
function shortLabel(node: GraphNode): string {
  if (node.kind === 'sprint' && node.sprint != null) {
    return `S${node.sprint}`;
  }
  if (node.id.startsWith('ADR-')) return node.id;
  const parts = node.id.split('-');
  if (parts.length > 2) return parts.slice(0, 2).join('-');
  return node.id;
}

/** mermaid에서 안전한 노드 ID를 생성한다. */
function safeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9]/g, '_');
}

/* ─── mermaid 차트 생성 ─────────────────────────── */

/** AdjacencyList에서 mermaid graph LR 문자열을 생성한다. */
function buildChart(adj: AdjacencyList, focusId?: string): string {
  if (adj.nodes.length === 0) return 'graph LR\n  empty["(no related ADRs)"]';

  const lines: string[] = ['graph LR'];

  for (const node of adj.nodes) {
    const sid = safeId(node.id);
    const label = shortLabel(node);
    lines.push(`  ${sid}["${label}"]`);
  }

  const unresolvedIndices: number[] = [];
  let edgeIdx = 0;

  for (const edge of adj.edges) {
    const from = safeId(edge.from);
    const to = safeId(edge.to);
    if (edge.resolved) {
      lines.push(`  ${from} --> ${to}`);
    } else {
      lines.push(`  ${from} -.-> ${to}`);
    }
    if (!edge.resolved) unresolvedIndices.push(edgeIdx);
    edgeIdx++;
  }

  /* kind별 노드 색상 적용 */
  for (const node of adj.nodes) {
    const sid = safeId(node.id);
    if (focusId && node.id === focusId) {
      lines.push(`  style ${sid} fill:${FOCUS_STYLE.fill},color:${FOCUS_STYLE.color},stroke:${FOCUS_STYLE.stroke}`);
    } else {
      const kc = KIND_COLORS[node.kind];
      if (kc) {
        lines.push(`  style ${sid} fill:${kc.fill},color:${kc.color},stroke:${kc.stroke}`);
      }
    }
  }

  for (const idx of unresolvedIndices) {
    lines.push(`  linkStyle ${idx} stroke-dasharray:5`);
  }

  return lines.join('\n');
}

/* ─── 노드 링크 목록 ────────────────────────────── */

/** locale 기반 URL 경로를 생성한다. */
function nodeUrl(node: GraphNode, locale: Locale): string {
  const prefix = locale === 'en' ? '/en' : '';
  if (node.kind === 'sprint' && node.sprint != null) {
    return `${prefix}/adr/sprints/${node.sprint}/`;
  }
  if (node.id.startsWith('ADR-')) {
    const num = node.id.replace('ADR-', '');
    return `${prefix}/adr/permanent/${num}/`;
  }
  return `${prefix}/adr/topics/${node.id}/`;
}

/* ─── 컴포넌트 ──────────────────────────────────── */

/** Related ADR 그래프를 렌더링한다. */
export function RelatedAdrGraph({
  adjacency,
  focusId,
  caption,
  locale = 'ko',
}: RelatedAdrGraphProps) {
  const uid = useId().replace(/[:]/g, '');
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  const chart = buildChart(adjacency, focusId);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        const isDark =
          typeof document !== 'undefined' &&
          document.documentElement.classList.contains('dark');

        mermaid.initialize({
          startOnLoad: false,
          theme: isDark ? 'dark' : 'default',
          securityLevel: 'loose',
          fontFamily: 'inherit',
        });

        const { svg } = await mermaid.render(`g-${uid}`, chart);
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg;
        }
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : 'Mermaid render error',
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [chart, uid]);

  return (
    <div>
      <figure className="not-prose">
        <div
          ref={ref}
          className="overflow-x-auto rounded-lg border border-border bg-diagram-bg p-4 shadow-sm [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full"
        >
          {error && (
            <pre className="text-xs text-callout-danger-fg">{error}</pre>
          )}
        </div>
        {caption && (
          <figcaption className="mt-2 text-center text-xs text-text-muted">
            {caption}
          </figcaption>
        )}
      </figure>

      {/* 노드 목록 링크 — 클릭 이벤트 대안 */}
      {adjacency.nodes.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {adjacency.nodes.map((node) => (
            <li key={node.id}>
              <a
                href={nodeUrl(node, locale)}
                className={`inline-block rounded-md border px-2 py-1 text-xs transition-colors hover:border-brand hover:text-brand ${
                  node.id === focusId
                    ? 'border-brand bg-brand-soft font-medium text-brand-strong'
                    : 'border-border text-text-muted'
                }`}
              >
                {shortLabel(node)}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
