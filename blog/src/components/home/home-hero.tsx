/**
 * @file       home-hero.tsx
 * @domain     blog
 * @layer      ui
 * @related    src/lib/i18n.ts, src/lib/site-content.ts, src/components/home-page.tsx
 *
 * 홈 랜딩 Hero — 블로그가 "실제 운영 중인 AI Agent 서비스의 개발·운영 기록"임을
 * 첫 화면에서 전달한다. 배지 + 제목 + 서브카피 + CTA 3종(글/ADR/서비스).
 * Server Component — 모든 표시 텍스트는 i18n으로 ko/en 동시 현지화.
 */
import type { Locale } from '@/lib/i18n';
import { t } from '@/lib/i18n';
import { ALGOSU_SERVICE_URL } from '@/lib/site-content';

interface HomeHeroProps {
  locale: Locale;
  /** locale별 링크 기준 경로 (en: '/en', ko: ''). */
  basePath: string;
}

/** 공통 focus ring (키보드 접근성). */
const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface';

/** 홈 Hero 영역을 렌더링한다. */
export function HomeHero({ locale, basePath }: HomeHeroProps) {
  const adrHref = `${basePath}/adr/`;

  return (
    <section className="relative pt-6 sm:pt-12">
      {/* 아키텍처 그리드 배경 — Signal Grid 시각 언어 (장식, 접근성 무해) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-10 -z-10 h-64 opacity-[0.5] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_0%,#000,transparent)]"
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

      <h1 className="mt-6 font-heading text-4xl font-bold leading-[1.08] tracking-tight text-text sm:text-[3.25rem]">
        {t(locale, 'heroTitle')}
      </h1>

      <p className="mt-5 max-w-2xl text-base leading-relaxed text-text-muted sm:text-lg">
        {t(locale, 'heroSubcopy')}
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
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
