/**
 * @file       adr-meta-list.tsx
 * @domain     blog / adr
 * @layer      ui
 * @related    src/lib/adr/types.ts, adr-card.tsx, src/lib/i18n.ts
 *
 * 종류별 ADR 카드 목록(토픽·영구) — SprintsList 와 동일 마크업(DRY).
 * titleKey·locale prop 으로 헤딩/카드 href 토글. 정렬은 호출부에서 결정.
 */
import type { AdrMeta } from '@/lib/adr/types';
import { type DictKey, type Locale, t } from '@/lib/i18n';
import { AdrCard } from './adr-card';

interface AdrMetaListProps {
  items: AdrMeta[];
  titleKey: DictKey;
  locale?: Locale;
}

/** 종류별 ADR 카드 목록을 렌더링한다. */
export function AdrMetaList({ items, titleKey, locale = 'ko' }: AdrMetaListProps) {
  return (
    <section>
      <h1 className="mb-6 font-heading text-2xl font-bold tracking-tight text-text">
        {t(locale, titleKey)}
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
