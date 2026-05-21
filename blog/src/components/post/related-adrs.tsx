/**
 * @file       related-adrs.tsx
 * @domain     blog / adr
 * @layer      ui
 * @related    src/components/post-page.tsx, src/components/adr/featured-adr-section.tsx,
 *             src/lib/adr/index-builder.ts
 *
 * 글 하단 "관련 ADR" 섹션 — frontmatter relatedAdrs(id)를 카드로 렌더한다.
 * 제목·한 줄(tldr)은 AdrMeta에서, 링크는 buildUrl로 생성(게이트 정합).
 * 조회 실패 id는 graceful skip. 대표 ADR 섹션(FeaturedAdrSection)과 동일 패턴.
 */
import type { AdrMeta } from '@/lib/adr/types';
import { buildUrl } from '@/lib/adr/index-builder';
import { type Locale, t } from '@/lib/i18n';

interface RelatedAdrsProps {
  /** frontmatter relatedAdrs — AdrMeta.id 목록. */
  ids: readonly string[];
  /** id -> AdrMeta 조회 맵. */
  adrById: Map<string, AdrMeta>;
  locale: Locale;
}

/** 공통 focus ring (키보드 접근성). */
const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface';

/** 글의 관련 ADR 섹션을 렌더한다. 유효 카드가 없으면 렌더하지 않는다. */
export function RelatedAdrs({ ids, adrById, locale }: RelatedAdrsProps) {
  const cards = ids
    .map((id) => adrById.get(id))
    .filter((meta): meta is AdrMeta => meta !== undefined);

  if (cards.length === 0) return null;

  return (
    <section className="mt-12 border-t border-border pt-8">
      <h2 className="font-heading text-lg font-semibold text-text">
        {t(locale, 'relatedAdrsTitle')}
      </h2>
      <p className="mt-1 text-sm text-text-muted">
        {t(locale, 'relatedAdrsSubtitle')}
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {cards.map((meta) => (
          <a
            key={meta.id}
            href={buildUrl(meta, locale)}
            className={`group flex flex-col rounded-card border border-border bg-surface-elevated p-5 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-brand hover:shadow-lift ${FOCUS_RING}`}
          >
            <span className="inline-flex w-fit rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-semibold text-brand-strong">
              {meta.id}
            </span>
            <h3 className="mt-2 font-heading text-base font-bold text-text transition-colors group-hover:text-brand">
              {meta.title}
            </h3>
            {meta.tldr && (
              <p className="mt-1.5 line-clamp-2 text-sm text-text-muted">
                {meta.tldr}
              </p>
            )}
          </a>
        ))}
      </div>
    </section>
  );
}
