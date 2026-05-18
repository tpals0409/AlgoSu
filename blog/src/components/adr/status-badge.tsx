/**
 * @file       status-badge.tsx
 * @domain     blog / adr
 * @layer      ui
 * @related    src/lib/adr/types.ts, src/lib/i18n.ts
 *
 * ADR 상태 pill 뱃지 — status 값에 따라 callout 토큰 색상을 매핑한다.
 * locale prop으로 라벨 KR/EN 토글 (라벨 없으면 status 값 그대로).
 */
import type { AdrStatus } from '@/lib/adr/types';
import { type Locale, t, type DictKey } from '@/lib/i18n';

interface StatusBadgeProps {
  status: AdrStatus;
  rawStatus?: string;
  locale?: Locale;
}

/** status -> Tailwind 클래스 매핑 */
const STATUS_STYLES: Record<AdrStatus, string> = {
  completed:
    'bg-callout-success-bg text-callout-success-fg border-callout-success-border',
  implemented:
    'bg-callout-success-bg text-callout-success-fg border-callout-success-border',
  accepted:
    'bg-callout-info-bg text-callout-info-fg border-callout-info-border',
  proposed:
    'bg-callout-warn-bg text-callout-warn-fg border-callout-warn-border',
  deferred: 'bg-surface-muted text-text-muted border-border',
  partial: 'bg-surface-muted text-text-muted border-border',
  rejected:
    'bg-callout-danger-bg text-callout-danger-fg border-callout-danger-border',
  unknown: 'border-dashed border-border text-text-subtle',
};

/** status -> i18n 사전 키 매핑 */
const STATUS_LABEL_KEY: Record<AdrStatus, DictKey> = {
  completed: 'statusCompleted',
  implemented: 'statusImplemented',
  accepted: 'statusAccepted',
  proposed: 'statusProposed',
  deferred: 'statusDeferred',
  partial: 'statusPartial',
  rejected: 'statusRejected',
  unknown: 'statusUnknown',
};

/** ADR 상태를 pill 형태로 렌더링한다. */
export function StatusBadge({
  status,
  rawStatus,
  locale = 'ko',
}: StatusBadgeProps) {
  const style = STATUS_STYLES[status];
  const label = t(locale, STATUS_LABEL_KEY[status]);

  return (
    <span
      title={rawStatus ?? label}
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${style}`}
    >
      {label}
    </span>
  );
}
