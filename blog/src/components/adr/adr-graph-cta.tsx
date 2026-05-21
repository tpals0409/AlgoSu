/**
 * @file       adr-graph-cta.tsx
 * @domain     blog / adr
 * @layer      ui
 * @related    src/lib/i18n.ts, src/components/adr/adr-landing-view.tsx
 *
 * ADR 그래프 진입 카드 — 관계 그래프(/adr/graph)로 안내.
 * 설명/범례·필터는 Phase 5로, 이번엔 진입 CTA만. Server Component.
 */
import { type Locale, t, getBasePath } from '@/lib/i18n';

interface AdrGraphCtaProps {
  locale: Locale;
}

/** 공통 focus ring (키보드 접근성). */
const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface';

/** ADR 그래프 진입 카드를 렌더링한다. */
export function AdrGraphCta({ locale }: AdrGraphCtaProps) {
  const href = `${getBasePath(locale)}/adr/graph/`;

  return (
    <a
      href={href}
      className={`group flex items-start justify-between gap-4 rounded-card border border-border bg-surface-elevated p-6 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-brand hover:shadow-lift ${FOCUS_RING}`}
    >
      <div>
        <h2 className="font-heading text-lg font-semibold text-text">
          {t(locale, 'adrGraphCtaTitle')}
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          {t(locale, 'adrGraphCtaDesc')}
        </p>
      </div>
      <span className="shrink-0 self-center text-sm font-medium text-brand transition-transform group-hover:translate-x-0.5">
        {t(locale, 'adrGraphCtaButton')}
      </span>
    </a>
  );
}
