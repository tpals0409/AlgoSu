/**
 * @file       adr-landing-view.tsx
 * @domain     blog / adr
 * @layer      ui
 * @related    src/lib/adr/types.ts, adr-landing-hero.tsx, featured-adr-section.tsx,
 *             adr-topic-collections.tsx
 *
 * ADR 큐레이션 랜딩(/adr) — Hero → 대표 ADR → 주제별 → 아카이브 CTA.
 * 전체 목록(통계·타임라인·전수)은 /adr/archive(AdrIndexView)로 분리.
 * locale prop으로 KR/EN 동시 렌더 + 링크 prefix 전파.
 */
import type { AdrIndex, AdrMeta } from '@/lib/adr/types';
import { type Locale, t, tf, getBasePath } from '@/lib/i18n';
import { AdrLandingHero } from './adr-landing-hero';
import { FeaturedAdrSection } from './featured-adr-section';
import { AdrTopicCollections } from './adr-topic-collections';

interface AdrLandingViewProps {
  index: AdrIndex;
  locale?: Locale;
}

/** 공통 focus ring (키보드 접근성). */
const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface';

/** id -> AdrMeta 조회 맵을 만든다. */
function buildAdrByIdMap(metas: AdrMeta[]): Map<string, AdrMeta> {
  return new Map(metas.map((m) => [m.id, m]));
}

/** ADR 큐레이션 랜딩 뷰를 렌더링한다. */
export function AdrLandingView({ index, locale = 'ko' }: AdrLandingViewProps) {
  const adrById = buildAdrByIdMap(index.all);
  const archiveHref = `${getBasePath(locale)}/adr/archive/`;

  return (
    <div className="space-y-12">
      <AdrLandingHero locale={locale} />
      <FeaturedAdrSection adrById={adrById} locale={locale} />
      <AdrTopicCollections adrById={adrById} locale={locale} />

      {/* 전체 아카이브 진입 */}
      <a
        href={archiveHref}
        className={`group flex items-start justify-between gap-4 rounded-card border border-border bg-surface-elevated p-6 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-brand hover:shadow-lift ${FOCUS_RING}`}
      >
        <div>
          <h2 className="font-heading text-lg font-semibold text-text">
            {t(locale, 'adrArchiveCtaTitle')}
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            {tf(locale, 'adrArchiveCtaDesc', { n: index.all.length })}
          </p>
        </div>
        <span className="shrink-0 self-center text-sm font-medium text-brand transition-transform group-hover:translate-x-0.5">
          {t(locale, 'adrArchiveCtaButton')}
        </span>
      </a>
    </div>
  );
}
