/**
 * @file       adr-carryover-callout.tsx
 * @domain     blog / adr
 * @layer      ui
 * @related    src/lib/adr/types.ts, src/lib/i18n.ts
 *
 * ADR 이월 callout — carryover 섹션의 list item을 info 톤 박스로 강조 렌더.
 * Sprint NNN 태그를 chip으로 우측 분리하여 라벨 가독성을 높인다.
 */
import type { AdrCarryoverEntry } from '@/lib/adr/types';
import { type Locale, t } from '@/lib/i18n';

interface AdrCarryoverCalloutProps {
  carryover?: AdrCarryoverEntry[];
  locale?: Locale;
}

/** Sprint NNN 라벨 chip을 렌더링한다. */
function SprintChip({ sprint, locale }: { sprint: string; locale: Locale }) {
  return (
    <span className="ml-2 inline-flex items-center rounded-md border border-callout-info-border bg-callout-info-bg px-1.5 py-0.5 text-[10px] font-mono font-semibold text-callout-info-fg">
      {t(locale, 'carryoverSprintPrefix')} {sprint}
    </span>
  );
}

/** 개별 이월 항목을 렌더링한다. */
function CarryoverItem({
  entry,
  locale,
}: {
  entry: AdrCarryoverEntry;
  locale: Locale;
}) {
  return (
    <li className="leading-relaxed">
      {entry.title && (
        <span className="font-semibold text-callout-info-fg">
          {entry.title}
          {entry.sprint && <SprintChip sprint={entry.sprint} locale={locale} />}
          <span aria-hidden="true">: </span>
        </span>
      )}
      <span className="text-callout-info-fg/90">{entry.description}</span>
    </li>
  );
}

/** ADR 이월 callout 박스를 렌더링한다. */
export function AdrCarryoverCallout({
  carryover,
  locale = 'ko',
}: AdrCarryoverCalloutProps) {
  if (!carryover || carryover.length === 0) return null;

  return (
    <aside
      role="note"
      aria-label={t(locale, 'carryoverTitle')}
      className="mb-6 rounded-lg border border-callout-info-border bg-callout-info-bg/50 p-4"
    >
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-callout-info-fg">
        <span aria-hidden="true">📋</span>
        <span>{t(locale, 'carryoverTitle')}</span>
      </div>
      <ul className="ml-1 list-disc space-y-2 pl-4 text-sm">
        {carryover.map((entry, i) => (
          <CarryoverItem key={i} entry={entry} locale={locale} />
        ))}
      </ul>
    </aside>
  );
}
