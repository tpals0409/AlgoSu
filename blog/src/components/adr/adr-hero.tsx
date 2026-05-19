/**
 * @file       adr-hero.tsx
 * @domain     blog / adr
 * @layer      ui
 * @related    src/lib/adr/types.ts, impact-badge.tsx, src/lib/i18n.ts
 *
 * ADR 상세 페이지 Hero 영역 — TL;DR 텍스트 + 지표 row (Date / Impact / PR 수 / Lines).
 */
import type { AdrDoc } from '@/lib/adr/types';
import { type Locale, t } from '@/lib/i18n';
import { ImpactBadge } from './impact-badge';

interface AdrHeroProps {
  doc: AdrDoc;
  locale?: Locale;
}

/** PR 표 행에서 총 PR 수를 계산한다. */
function countPrs(doc: AdrDoc): number {
  if (doc.phases && doc.phases.length > 0) return doc.phases.length;

  let count = 0;
  for (const s of doc.sections) {
    if (s.prTable) count += s.prTable.length;
  }
  return count;
}

/** PR 표 행의 Lines 값을 합산하여 문자열로 반환한다. */
function sumLines(doc: AdrDoc): string | undefined {
  if (!doc.phases) return undefined;

  let additions = 0;
  let deletions = 0;
  let hasData = false;

  for (const phase of doc.phases) {
    if (!phase.lines) continue;
    const addMatch = phase.lines.match(/\+(\d+)/);
    const delMatch = phase.lines.match(/-(\d+)|−(\d+)/);
    if (addMatch) { additions += parseInt(addMatch[1], 10); hasData = true; }
    if (delMatch) {
      const val = delMatch[1] ?? delMatch[2];
      deletions += parseInt(val, 10);
      hasData = true;
    }
  }

  if (!hasData) return undefined;
  const parts: string[] = [];
  if (additions > 0) parts.push(`+${additions}`);
  if (deletions > 0) parts.push(`-${deletions}`);
  return parts.join(' ');
}

/** ADR 상세 페이지 Hero 영역을 렌더링한다. */
export function AdrHero({ doc, locale = 'ko' }: AdrHeroProps) {
  const { meta } = doc;
  const prCount = countPrs(doc);
  const totalLines = sumLines(doc);

  return (
    <section className="mb-6 rounded-xl bg-surface-muted p-6">
      {/* TL;DR */}
      {meta.tldr && (
        <p className="mb-4 text-lg leading-relaxed text-text-muted">
          <span className="mr-2 font-semibold text-text">
            {t(locale, 'heroTldr')}
          </span>
          {meta.tldr}
        </p>
      )}

      {/* 지표 row */}
      <div className="flex flex-wrap items-center gap-4 text-sm text-text-muted">
        {meta.date && (
          <StatItem label={t(locale, 'heroDate')}>
            <time dateTime={meta.date}>{meta.date}</time>
          </StatItem>
        )}
        <StatItem label={t(locale, 'heroImpact')}>
          <ImpactBadge impact={meta.impact} locale={locale} />
        </StatItem>
        {prCount > 0 && (
          <StatItem label={t(locale, 'heroPrCount')}>
            {prCount}
          </StatItem>
        )}
        {totalLines && (
          <StatItem label={t(locale, 'heroLines')}>
            <span className="font-mono text-xs">{totalLines}</span>
          </StatItem>
        )}
      </div>
    </section>
  );
}

/** 지표 row의 개별 항목을 렌더링한다. */
function StatItem({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-text-subtle">{label}</span>
      <span className="font-medium text-text">{children}</span>
    </div>
  );
}
