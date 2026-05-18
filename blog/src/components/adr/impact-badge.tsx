/**
 * @file       impact-badge.tsx
 * @domain     blog / adr
 * @layer      ui
 * @related    src/lib/adr/types.ts, src/lib/i18n.ts
 *
 * ADR 영향도 pill 뱃지 — 4단계 accent 색상 매핑.
 * locale prop으로 라벨 KR/EN 토글.
 */
import type { Impact } from '@/lib/adr/types';
import { type Locale, t, type DictKey } from '@/lib/i18n';

interface ImpactBadgeProps {
  impact: Impact;
  locale?: Locale;
}

/** impact -> Tailwind 클래스 매핑 */
const IMPACT_STYLES: Record<Impact, string> = {
  low: 'bg-callout-info-bg text-callout-info-fg border-callout-info-border',
  medium: 'bg-callout-warn-bg text-callout-warn-fg border-callout-warn-border',
  high: 'bg-callout-danger-bg text-callout-danger-fg border-callout-danger-border',
  critical:
    'bg-callout-danger-bg text-callout-danger-fg border-callout-danger-border font-bold',
};

/** impact -> 사전 키 매핑 */
const IMPACT_LABEL_KEY: Record<Impact, DictKey> = {
  low: 'impactLow',
  medium: 'impactMedium',
  high: 'impactHigh',
  critical: 'impactCritical',
};

/** ADR 영향도를 pill 형태로 렌더링한다. */
export function ImpactBadge({ impact, locale = 'ko' }: ImpactBadgeProps) {
  const style = IMPACT_STYLES[impact];
  const label = t(locale, IMPACT_LABEL_KEY[impact]);

  return (
    <span
      title={impact}
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${style}`}
    >
      {label}
    </span>
  );
}
