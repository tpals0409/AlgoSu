/**
 * @file       adr-phase-strip.tsx
 * @domain     blog / adr
 * @layer      ui
 * @related    src/lib/adr/types.ts, src/lib/i18n.ts
 *
 * ADR Phase 가로 스크롤 strip — implementation PR 표의 Phase 엔트리를 카드로 시각화.
 */
import type { AdrPhaseEntry } from '@/lib/adr/types';
import { type Locale, t } from '@/lib/i18n';

interface AdrPhaseStripProps {
  phases?: AdrPhaseEntry[];
  locale?: Locale;
}

/** 개별 Phase 카드를 렌더링한다. */
function PhaseCard({ entry }: { entry: AdrPhaseEntry }) {
  return (
    <div className="min-w-[200px] rounded-lg border border-border bg-surface-elevated p-3">
      <div className="text-xs font-semibold text-brand">
        {entry.phase}
      </div>
      {entry.prNumber && (
        <PrLink prNumber={entry.prNumber} prUrl={entry.prUrl} />
      )}
      <p className="mt-1 line-clamp-2 text-xs text-text-muted">
        {entry.summary}
      </p>
      <div className="mt-1.5 flex items-center gap-2 text-[10px] text-text-subtle">
        <span>{entry.owner}</span>
        {entry.lines && (
          <span className="font-mono">{entry.lines}</span>
        )}
      </div>
    </div>
  );
}

/** PR 번호 링크를 렌더링한다. */
function PrLink({
  prNumber,
  prUrl,
}: {
  prNumber: string;
  prUrl?: string;
}) {
  if (prUrl) {
    return (
      <a
        href={prUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-brand hover:underline"
      >
        #{prNumber}
      </a>
    );
  }

  return (
    <span className="text-xs text-brand">#{prNumber}</span>
  );
}

/** ADR Phase strip을 가로 스크롤 카드로 렌더링한다. */
export function AdrPhaseStrip({
  phases,
  locale = 'ko',
}: AdrPhaseStripProps) {
  if (!phases || phases.length === 0) return null;

  return (
    <section className="mb-6">
      <h3 className="mb-3 text-sm font-semibold text-text-subtle">
        {t(locale, 'phaseStripTitle')}
      </h3>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {phases.map((entry, i) => (
          <PhaseCard key={i} entry={entry} />
        ))}
      </div>
    </section>
  );
}
