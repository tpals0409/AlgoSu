/**
 * @file       featured-adr-section.tsx
 * @domain     blog / adr
 * @layer      ui
 * @related    src/lib/site-content.ts, src/lib/adr/index-builder.ts, src/components/adr/adr-landing-view.tsx
 *
 * 대표 ADR 섹션 — FEATURED_ADRS를 카드로 렌더링.
 * 제목·한 줄(tldr)은 AdrMeta에서, "왜 읽어야 하나"는 i18n에서 가져온다.
 * 링크는 buildUrl로 생성(게이트 정합). 조회 실패 id는 graceful skip.
 */
import type { AdrMeta } from '@/lib/adr/types';
import { buildUrl } from '@/lib/adr/index-builder';
import { type Locale, t } from '@/lib/i18n';
import { FEATURED_ADRS, type FeaturedAdr } from '@/lib/site-content';

interface FeaturedAdrSectionProps {
  /** id -> AdrMeta 조회 맵. */
  adrById: Map<string, AdrMeta>;
  locale: Locale;
}

/** 공통 focus ring (키보드 접근성). */
const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface';

/** 대표 ADR 섹션을 렌더링한다. */
export function FeaturedAdrSection({ adrById, locale }: FeaturedAdrSectionProps) {
  const cards = FEATURED_ADRS.map((featured) => {
    const meta = adrById.get(featured.id);
    return meta ? { featured, meta } : null;
  }).filter((c): c is { featured: FeaturedAdr; meta: AdrMeta } => c !== null);

  if (cards.length === 0) return null;

  return (
    <section>
      <h2 className="font-heading text-xl font-bold text-text">
        {t(locale, 'adrFeaturedTitle')}
      </h2>
      <p className="mt-1 text-sm text-text-muted">
        {t(locale, 'adrFeaturedSubtitle')}
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(({ featured, meta }) => (
          <a
            key={featured.id}
            href={buildUrl(meta, locale)}
            className={`group flex flex-col rounded-card border border-border bg-surface-elevated p-5 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-brand hover:shadow-lift ${FOCUS_RING}`}
          >
            <span className="inline-flex w-fit rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-semibold text-brand-strong">
              {meta.id}
            </span>
            <h3 className="mt-2 font-heading text-base font-bold text-text">
              {meta.title}
            </h3>
            {meta.tldr && (
              <p className="mt-1.5 line-clamp-2 text-sm text-text-muted">
                {meta.tldr}
              </p>
            )}
            <p className="mt-3 border-t border-border pt-3 text-xs leading-relaxed text-text-subtle">
              <span className="font-semibold text-brand">
                {t(locale, 'adrFeaturedWhyLabel')}
              </span>{' '}
              {t(locale, featured.whyKey)}
            </p>
          </a>
        ))}
      </div>
    </section>
  );
}
