/**
 * @file       adr-decisions-grid.tsx
 * @domain     blog / adr
 * @layer      ui
 * @related    src/lib/adr/types.ts, src/lib/i18n.ts
 *
 * ADR 결정 사항 2열 카드 그리드 — decisions 섹션의 볼드 항목을 시각적 카드로 렌더.
 */
import type { AdrDecision } from '@/lib/adr/types';
import { type Locale, t } from '@/lib/i18n';

interface AdrDecisionsGridProps {
  decisions?: AdrDecision[];
  locale?: Locale;
}

/** 개별 결정 카드를 렌더링한다. */
function DecisionCard({ decision }: { decision: AdrDecision }) {
  return (
    <div className="rounded-lg border border-border bg-surface-elevated p-4">
      <h4 className="text-sm font-semibold text-text">
        {decision.title}
      </h4>
      <p className="mt-1 line-clamp-3 text-xs text-text-muted">
        {decision.description}
      </p>
    </div>
  );
}

/** ADR 결정 사항을 2열 카드 그리드로 렌더링한다. */
export function AdrDecisionsGrid({
  decisions,
  locale = 'ko',
}: AdrDecisionsGridProps) {
  if (!decisions || decisions.length === 0) return null;

  return (
    <section className="mb-6">
      <h3 className="mb-3 text-sm font-semibold text-text-subtle">
        {t(locale, 'decisionsTitle')}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {decisions.map((d, i) => (
          <DecisionCard key={i} decision={d} />
        ))}
      </div>
    </section>
  );
}
