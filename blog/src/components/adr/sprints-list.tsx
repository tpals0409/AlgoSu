/**
 * @file       sprints-list.tsx
 * @domain     blog / adr
 * @layer      ui
 * @related    src/lib/adr/types.ts, adr-card.tsx
 *
 * Sprint ADR 전체 목록 — 내림차순 정렬, 카드 리스트.
 */
import type { AdrMeta } from '@/lib/adr/types';
import { AdrCard } from './adr-card';

interface SprintsListProps {
  items: AdrMeta[];
}

/** Sprint ADR 전체 목록을 렌더링한다. */
export function SprintsList({ items }: SprintsListProps) {
  return (
    <section>
      <h1 className="mb-6 text-2xl font-bold text-text">
        Sprint ADR 전체 목록
        <span className="ml-2 text-base font-normal text-text-muted">
          ({items.length})
        </span>
      </h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((m) => (
          <AdrCard key={m.id} meta={m} />
        ))}
      </div>
    </section>
  );
}
