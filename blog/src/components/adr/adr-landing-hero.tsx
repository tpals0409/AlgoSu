/**
 * @file       adr-landing-hero.tsx
 * @domain     blog / adr
 * @layer      ui
 * @related    src/lib/i18n.ts, src/lib/site-content.ts, src/components/adr/adr-landing-view.tsx
 *
 * ADR 랜딩(/adr) Hero — 제목 + 서브카피 + "ADR 읽는 법" 4단계(문제→선택지→결정→검증).
 * ADR 상세 Hero(adr-hero.tsx)와 별개. Server Component, 표시 텍스트는 i18n으로 ko/en 동시 현지화.
 */
import type { Locale } from '@/lib/i18n';
import { t } from '@/lib/i18n';
import { ADR_READING_STEPS } from '@/lib/site-content';

interface AdrLandingHeroProps {
  locale: Locale;
}

/** ADR 랜딩 Hero와 읽는 법 4단계를 렌더링한다. */
export function AdrLandingHero({ locale }: AdrLandingHeroProps) {
  return (
    <section className="pt-2 sm:pt-4">
      <h1 className="font-heading text-3xl font-bold leading-[1.15] tracking-tight text-text sm:text-4xl">
        {t(locale, 'adrLandingHeroTitle')}
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-text-muted">
        {t(locale, 'adrLandingHeroSubtitle')}
      </p>

      <div className="mt-8 rounded-card border border-border bg-surface-elevated p-5 shadow-soft sm:p-6">
        <h2 className="font-heading text-xs font-semibold uppercase tracking-wide text-text-subtle">
          {t(locale, 'adrHowToReadTitle')}
        </h2>
        <ol className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ADR_READING_STEPS.map((step, i) => (
            <li key={step.titleKey} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-soft font-heading text-sm font-bold text-brand-strong">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-semibold text-text">
                  {t(locale, step.titleKey)}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-text-muted">
                  {t(locale, step.descKey)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
