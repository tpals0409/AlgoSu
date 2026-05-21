/**
 * @file       about-hero.tsx
 * @domain     blog
 * @layer      ui
 * @related    src/lib/i18n.ts, src/lib/site-content.ts, src/components/about-page.tsx
 *
 * About Hero — 이름 + 역할 배지 + 태그라인 + 자기소개 + 외부 링크 CTA(GitHub/서비스).
 * Server Component — 모든 표시 텍스트는 i18n으로 ko/en 동시 현지화.
 */
import type { Locale } from '@/lib/i18n';
import { t } from '@/lib/i18n';
import { ALGOSU_SERVICE_URL, GITHUB_URL } from '@/lib/site-content';

interface AboutHeroProps {
  locale: Locale;
}

/** 공통 focus ring (키보드 접근성). */
const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface';

/** About 페이지 Hero 영역을 렌더링한다. */
export function AboutHero({ locale }: AboutHeroProps) {
  return (
    <section className="pt-4 sm:pt-8">
      <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-3.5 py-1.5 text-xs font-medium text-text-muted">
        <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden />
        {t(locale, 'aboutRole')}
      </span>

      <h1 className="mt-5 font-heading text-4xl font-bold leading-[1.1] tracking-tight text-text sm:text-5xl">
        {t(locale, 'aboutName')}
      </h1>

      <p className="mt-4 font-heading text-lg font-semibold text-brand sm:text-xl">
        {t(locale, 'aboutTagline')}
      </p>

      <div className="mt-6 max-w-2xl space-y-4 text-base leading-relaxed text-text-muted">
        <p>{t(locale, 'aboutIntro1')}</p>
        <p>{t(locale, 'aboutIntro2')}</p>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center justify-center gap-1 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-brand-strong ${FOCUS_RING}`}
        >
          {t(locale, 'aboutCtaGithub')}
          <span aria-hidden>↗</span>
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
