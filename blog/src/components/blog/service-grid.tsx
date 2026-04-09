/**
 * @file       service-grid.tsx
 * @domain     blog
 * @layer      ui
 * @related    src/components/mdx-components.tsx
 *
 * 마이크로서비스/구성요소를 카드 격자로 표시. ASCII 박스 대체.
 */
import type { ReactNode } from 'react';

interface ServiceGridProps {
  cols?: 2 | 3 | 4;
  children: ReactNode;
}

interface ServiceCardProps {
  name: string;
  tech?: string;
  port?: string;
  role?: ReactNode;
  accent?: 1 | 2 | 3 | 4 | 5 | 6;
}

const ACCENT_BORDER: Record<number, string> = {
  1: 'border-t-accent-1',
  2: 'border-t-accent-2',
  3: 'border-t-accent-3',
  4: 'border-t-accent-4',
  5: 'border-t-accent-5',
  6: 'border-t-accent-6',
};

const COLS: Record<number, string> = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-2 md:grid-cols-3',
  4: 'sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
};

export function ServiceGrid({ cols = 3, children }: ServiceGridProps) {
  return (
    <div className={`my-6 grid grid-cols-1 gap-3 not-prose ${COLS[cols]}`}>{children}</div>
  );
}

export function ServiceCard({ name, tech, port, role, accent = 1 }: ServiceCardProps) {
  return (
    <div
      className={`rounded-lg border border-t-4 bg-surface-elevated p-4 ${ACCENT_BORDER[accent]}`}
      style={{ borderColor: 'var(--border)' }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="text-sm font-bold text-text">{name}</h4>
        {port && (
          <span className="font-mono text-xs text-text-muted">:{port}</span>
        )}
      </div>
      {tech && <p className="mt-0.5 text-xs text-text-subtle">{tech}</p>}
      {role && <p className="mt-2 text-xs leading-relaxed text-text-muted">{role}</p>}
    </div>
  );
}
