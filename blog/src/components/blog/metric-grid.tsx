/**
 * @file       metric-grid.tsx
 * @domain     blog
 * @layer      ui
 * @related    src/components/mdx-components.tsx
 *
 * 핵심 수치를 카드 그리드로 표시. e.g. "67 sprints / 2,432 tests / 15 jobs".
 */
import type { ReactNode } from 'react';

interface MetricGridProps {
  cols?: 2 | 3 | 4;
  children: ReactNode;
}

interface MetricCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  accent?: 1 | 2 | 3 | 4 | 5 | 6;
}

const ACCENT_BORDER: Record<number, string> = {
  1: 'border-l-accent-1',
  2: 'border-l-accent-2',
  3: 'border-l-accent-3',
  4: 'border-l-accent-4',
  5: 'border-l-accent-5',
  6: 'border-l-accent-6',
};

const COLS: Record<number, string> = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-2 md:grid-cols-3',
  4: 'sm:grid-cols-2 md:grid-cols-4',
};

export function MetricGrid({ cols = 3, children }: MetricGridProps) {
  return (
    <div className={`my-6 grid grid-cols-1 gap-3 not-prose ${COLS[cols]}`}>{children}</div>
  );
}

export function MetricCard({ label, value, hint, accent = 1 }: MetricCardProps) {
  return (
    <div
      className={`rounded-lg border border-l-4 bg-surface-muted px-4 py-3 ${ACCENT_BORDER[accent]}`}
      style={{ borderColor: 'var(--border)' }}
    >
      <div className="text-xs font-medium text-text-muted">{label}</div>
      <div className="mt-1 text-2xl font-bold text-text">{value}</div>
      {hint && <div className="mt-1 text-xs text-text-subtle">{hint}</div>}
    </div>
  );
}
