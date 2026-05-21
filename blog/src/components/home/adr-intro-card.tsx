/**
 * @file       adr-intro-card.tsx
 * @domain     blog
 * @layer      ui
 * @related    src/lib/i18n.ts, src/components/home-page.tsx
 *
 * 홈 ADR 소개 카드 — 블로그 글이 인용하는 결정·구현·검증의 SSOT인 ADR로 안내.
 * ADR 개수는 빌드타임 동적 값(stale 하드코딩 차단). Server Component.
 */
import type { Locale } from '@/lib/i18n';
import { t, tf } from '@/lib/i18n';

interface AdrIntroCardProps {
  locale: Locale;
  /** locale별 링크 기준 경로 (en: '/en', ko: ''). */
  basePath: string;
  /** 빌드타임 ADR 총 개수. */
  adrCount: number;
}

/** 공통 focus ring. */
const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface';

/** ADR 진입 소개 카드를 렌더링한다. */
export function AdrIntroCard({ locale, basePath, adrCount }: AdrIntroCardProps) {
  const adrHref = `${basePath}/adr/`;

  return (
    <a
      href={adrHref}
      className={`group block rounded-card border border-border bg-surface-elevated p-6 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-brand hover:shadow-lift ${FOCUS_RING}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-heading text-lg font-semibold text-text">
            {t(locale, 'homeAdrCtaTitle')}
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            {tf(locale, 'homeAdrCtaDescription', { n: adrCount })}
          </p>
          <p className="mt-2 text-xs text-text-subtle">{t(locale, 'homeAdrCtaWhy')}</p>
        </div>
        <span className="shrink-0 self-center text-sm font-medium text-brand transition-transform group-hover:translate-x-0.5">
          {t(locale, 'homeAdrCtaButton')}
        </span>
      </div>
    </a>
  );
}
