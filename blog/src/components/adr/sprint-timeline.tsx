/**
 * @file       sprint-timeline.tsx
 * @domain     blog / adr
 * @layer      ui
 * @related    src/lib/adr/types.ts
 *
 * 가로 스크롤 SVG 막대 그래프 — sprint별 영향도를 시각화한다.
 */
import type { AdrMeta, Impact } from '@/lib/adr/types';

interface SprintTimelineProps {
  items: AdrMeta[];
  activeSprint?: number;
}

/** Impact -> 막대 높이 매핑 */
const IMPACT_HEIGHT: Record<Impact, number> = {
  low: 20,
  medium: 40,
  high: 60,
  critical: 80,
};

/** Impact -> 색상 CSS variable 매핑 */
const IMPACT_FILL: Record<Impact, string> = {
  low: 'var(--accent-1)',
  medium: 'var(--accent-2)',
  high: 'var(--accent-4)',
  critical: 'var(--callout-danger-fg)',
};

/** 막대 폭과 간격 */
const BAR_WIDTH = 16;
const BAR_GAP = 4;
const SVG_PADDING = 8;
const SVG_HEIGHT = 100;

/** sprint 막대 그래프를 SVG로 렌더링한다. */
export function SprintTimeline({ items, activeSprint }: SprintTimelineProps) {
  const sprints = items
    .filter((m) => m.kind === 'sprint' && m.sprint != null)
    .sort((a, b) => (a.sprint ?? 0) - (b.sprint ?? 0));

  if (sprints.length === 0) return null;

  const totalWidth =
    sprints.length * (BAR_WIDTH + BAR_GAP) - BAR_GAP + SVG_PADDING * 2;

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface-muted p-2">
      <svg
        width={totalWidth}
        height={SVG_HEIGHT}
        viewBox={`0 0 ${totalWidth} ${SVG_HEIGHT}`}
        role="img"
        aria-label="Sprint timeline bar chart"
      >
        {sprints.map((m, i) => {
          const x = SVG_PADDING + i * (BAR_WIDTH + BAR_GAP);
          const h = IMPACT_HEIGHT[m.impact];
          const y = SVG_HEIGHT - h - 4;
          const isActive = m.sprint === activeSprint;
          const fill = isActive ? 'var(--brand)' : IMPACT_FILL[m.impact];

          return (
            <a key={m.id} href={`/adr/sprints/${m.slug}/`}>
              <title>
                Sprint {m.sprint}: {m.title}
              </title>
              <rect
                x={x}
                y={y}
                width={BAR_WIDTH}
                height={h}
                rx={3}
                fill={fill}
                opacity={isActive ? 1 : 0.75}
              />
            </a>
          );
        })}
      </svg>
    </div>
  );
}
