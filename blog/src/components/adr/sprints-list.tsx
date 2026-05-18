/**
 * @file       sprints-list.tsx
 * @domain     blog / adr
 * @layer      ui
 * @related    src/lib/adr/types.ts, adr-card.tsx, src/lib/i18n.ts
 *
 * Sprint ADR 전체 목록 — 내림차순 정렬, 카드 리스트.
 * locale prop으로 헤딩 + 카드 href 토글.
 */
import type { AdrMeta } from '@/lib/adr/types';
import { type Locale, t } from '@/lib/i18n';
import { AdrCard } from './adr-card';

interface SprintsListProps {
  items: AdrMeta[];
  locale?: Locale;
}

/** Sprint ADR 전체 목록을 렌더링한다. */
export function SprintsList({ items, locale = 'ko' }: SprintsListProps) {
  return (
    <section>
      <h1 className="mb-6 text-2xl font-bold text-text">
        {t(locale, 'sprintsListTitle')}
        <span className="ml-2 text-base font-normal text-text-muted">
          ({items.length})
        </span>
      </h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((m) => (
          <AdrCard key={m.id} meta={m} locale={locale} />
        ))}
      </div>
    </section>
  );
}
