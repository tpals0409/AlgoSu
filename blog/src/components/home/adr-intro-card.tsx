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

/** ADR 진입 링크 블록(컴팩트 한 줄)을 렌더링한다. */
export function AdrIntroCard({ locale, basePath, adrCount }: AdrIntroCardProps) {
  const adrHref = `${basePath}/adr/`;

  return (
    <a
      href={adrHref}
      className={`group flex items-center justify-between gap-4 rounded-lg border border-border bg-surface px-4 py-3 transition-colors hover:border-brand ${FOCUS_RING}`}
    >
      <span className="min-w-0 text-sm text-text-muted">
        <span className="font-medium text-text">{t(locale, 'homeAdrCtaTitle')}</span>
        <span className="ml-2 text-text-subtle">
          {tf(locale, 'homeAdrCtaDescription', { n: adrCount })}
        </span>
      </span>
      <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-brand transition-transform group-hover:translate-x-0.5">
        {t(locale, 'homeAdrCtaButton')}
        <span aria-hidden>→</span>
      </span>
    </a>
  );
}
