/**
 * @file       impact-badge.tsx
 * @domain     blog / adr
 * @layer      ui
 * @related    src/lib/adr/types.ts
 *
 * ADR 영향도 pill 뱃지 — 4단계 accent 색상 매핑.
 */
import type { Impact } from '@/lib/adr/types';

interface ImpactBadgeProps {
  impact: Impact;
}

/** impact -> Tailwind 클래스 매핑 */
const IMPACT_STYLES: Record<Impact, string> = {
  low: 'bg-callout-info-bg text-callout-info-fg border-callout-info-border',
  medium: 'bg-callout-warn-bg text-callout-warn-fg border-callout-warn-border',
  high: 'bg-callout-danger-bg text-callout-danger-fg border-callout-danger-border',
  critical:
    'bg-callout-danger-bg text-callout-danger-fg border-callout-danger-border font-bold',
};

/** ADR 영향도를 pill 형태로 렌더링한다. */
export function ImpactBadge({ impact }: ImpactBadgeProps) {
  const style = IMPACT_STYLES[impact];

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${style}`}
    >
      {impact}
    </span>
  );
}
