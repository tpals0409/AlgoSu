/**
 * @file       adr-topic-collections.tsx
 * @domain     blog / adr
 * @layer      ui
 * @related    src/lib/site-content.ts, src/components/adr/adr-card.tsx, src/components/adr/adr-landing-view.tsx
 *
 * 주제별 ADR 컬렉션 — ADR_TOPICS 4주제, 각 멤버를 AdrCard로 렌더링.
 * 멤버 조회는 id 맵으로, 조회 실패 id는 graceful skip(빈 주제는 미렌더).
 */
import type { AdrMeta } from '@/lib/adr/types';
import { type Locale, t } from '@/lib/i18n';
import { ADR_TOPICS } from '@/lib/site-content';
import { AdrCard } from './adr-card';

interface AdrTopicCollectionsProps {
  /** id -> AdrMeta 조회 맵. */
  adrById: Map<string, AdrMeta>;
  locale: Locale;
}

/** 주제별 ADR 컬렉션을 렌더링한다. */
export function AdrTopicCollections({ adrById, locale }: AdrTopicCollectionsProps) {
  return (
    <section className="space-y-8">
      <div>
        <h2 className="font-heading text-xl font-bold text-text">
          {t(locale, 'adrTopicsTitle')}
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          {t(locale, 'adrTopicsSubtitle')}
        </p>
      </div>

      {ADR_TOPICS.map((topic) => {
        const members = topic.adrIds
          .map((id) => adrById.get(id))
          .filter((m): m is AdrMeta => m != null);
        if (members.length === 0) return null;

        return (
          <div key={topic.id} id={topic.id}>
            <h3 className="font-heading text-lg font-semibold text-text">
              {t(locale, topic.titleKey)}
            </h3>
            <p className="mt-0.5 text-sm text-text-muted">
              {t(locale, topic.descKey)}
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {members.map((m) => (
                <AdrCard key={m.id} meta={m} locale={locale} />
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}
