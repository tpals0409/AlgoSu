/**
 * @file       home-hero.tsx
 * @domain     blog
 * @layer      ui
 * @related    src/lib/i18n.ts, src/lib/site-content.ts, src/components/home-page.tsx
 *
 * 홈 랜딩 Hero(컴팩트) — 인덱스형 홈에 맞춰 배지 + 제목 + 서브카피 + 인라인 지표를
 * 한 블록으로 축약한다. 그리드 배경은 유지하되 톤다운. CTA 2종(ADR/서비스) 유지.
 * Server Component — 모든 표시 텍스트는 i18n으로 ko/en 동시 현지화.
 */
import type { Locale } from '@/lib/i18n';
import { t, tf } from '@/lib/i18n';
import { ALGOSU_SERVICE_URL } from '@/lib/site-content';

interface HomeHeroProps {
  locale: Locale;
  /** locale별 링크 기준 경로 (en: '/en', ko: ''). */
  basePath: string;
  /** 빌드타임 ADR 총 개수 — 인라인 지표 표시용. */
  adrCount: number;
  /** 빌드타임 글 총 개수 — 인라인 지표 표시용. */
  postCount: number;
}

/** 공통 focus ring (키보드 접근성). */
const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface';

/** 홈 Hero(컴팩트) 영역을 렌더링한다. */
export function HomeHero({ locale, basePath, adrCount, postCount }: HomeHeroProps) {
  const adrHref = `${basePath}/adr/`;

  return (
    <section className="relative pt-4 sm:pt-8">
      {/* 아키텍처 그리드 배경 — Signal Grid 시각 언어 (장식, 톤다운) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-8 -z-10 h-48 opacity-[0.3] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_0%,#000,transparent)]"
        style={{
          backgroundImage:
            'linear-gradient(to right, var(--diagram-grid) 1px, transparent 1px), linear-gradient(to bottom, var(--diagram-grid) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-3.5 py-1.5 text-xs font-medium text-text-muted shadow-soft">
        <span className="relative flex h-1.5 w-1.5" aria-hidden>
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand" />
        </span>
        {t(locale, 'heroBadge')}
      </span>

      <h1 className="mt-4 font-heading text-3xl font-bold leading-[1.12] tracking-tight text-text sm:text-4xl">
        {t(locale, 'heroTitle')}
      </h1>

      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-muted sm:text-base">
        {t(locale, 'heroSubcopy')}
      </p>

      <p className="mt-3 text-xs font-medium text-text-subtle">
        {tf(locale, 'homeStatsInline', { adr: adrCount, posts: postCount })}
      </p>

      <div className="mt-5 flex flex-wrap gap-3">
        <a
          href={adrHref}
          className={`inline-flex items-center justify-center rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-brand-strong ${FOCUS_RING}`}
        >
          {t(locale, 'heroCtaAdr')}
        </a>
        <a
          href={ALGOSU_SERVICE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center justify-center gap-1 rounded-full border border-border-strong bg-surface-elevated px-5 py-2.5 text-sm font-semibold text-text transition-colors hover:border-brand hover:text-brand ${FOCUS_RING}`}
        >
          {t(locale, 'heroCtaService')}
          <span aria-hidden>↗</span>
        </a>
      </div>
    </section>
  );
}
