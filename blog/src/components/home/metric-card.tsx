/**
 * @file       metric-card.tsx
 * @domain     blog
 * @layer      ui
 * @related    src/lib/site-content.ts, src/lib/i18n.ts, src/components/home-page.tsx
 *
 * 홈 성과 지표 카드 + 그리드. 숫자/제목/한 줄 설명 구조.
 * 값은 site-content의 SSOT(실데이터 검증분)에서, ADR 개수만 빌드타임 동적 주입.
 */
import type { Locale } from '@/lib/i18n';
import { t } from '@/lib/i18n';
import { HOME_METRICS } from '@/lib/site-content';

interface MetricCardProps {
  value: string;
  label: string;
  desc: string;
}

/** 단일 성과 지표 카드. */
export function MetricCard({ value, label, desc }: MetricCardProps) {
  return (
    <div className="rounded-card border border-border bg-surface-elevated p-5 shadow-soft">
      <p className="font-heading text-3xl font-bold tracking-tight text-brand">{value}</p>
      <p className="mt-2 text-sm font-semibold text-text">{label}</p>
      <p className="mt-1 text-xs leading-relaxed text-text-muted">{desc}</p>
    </div>
  );
}

interface MetricGridProps {
  locale: Locale;
  /** 빌드타임 ADR 총 개수 — value=null 지표에 주입(stale 방지). */
  adrCount: number;
}

/** 성과 지표 6종을 반응형 그리드로 렌더링한다(데스크탑 3열 / 모바일 1열). */
export function MetricGrid({ locale, adrCount }: MetricGridProps) {
  return (
    <section aria-labelledby="home-metrics-title">
      <h2
        id="home-metrics-title"
        className="mb-4 font-heading text-lg font-semibold text-text"
      >
        {t(locale, 'metricsTitle')}
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {HOME_METRICS.map((m) => (
          <MetricCard
            key={m.id}
            value={m.value ?? String(adrCount)}
            label={t(locale, m.labelKey)}
            desc={t(locale, m.descKey)}
          />
        ))}
      </div>
    </section>
  );
}
