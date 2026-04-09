/**
 * @file       tier-stack.tsx
 * @domain     blog
 * @layer      ui
 * @related    src/components/mdx-components.tsx
 *
 * 위→아래 계층 구조 표시. Tier 1/2/3 같은 stack 다이어그램 대체.
 */
import type { ReactNode } from 'react';

interface TierStackProps {
  children: ReactNode;
}

interface TierRowProps {
  tier: string | number;
  label: string;
  members?: string;
  accent?: 1 | 2 | 3 | 4 | 5 | 6;
}

const ACCENT_BG: Record<number, string> = {
  1: 'bg-accent-1',
  2: 'bg-accent-2',
  3: 'bg-accent-3',
  4: 'bg-accent-4',
  5: 'bg-accent-5',
  6: 'bg-accent-6',
};

export function TierStack({ children }: TierStackProps) {
  return <div className="my-6 flex flex-col gap-2 not-prose">{children}</div>;
}

export function TierRow({ tier, label, members, accent = 1 }: TierRowProps) {
  return (
    <div
      className="flex items-stretch overflow-hidden rounded-lg border bg-surface-elevated"
      style={{ borderColor: 'var(--border)' }}
    >
      <div
        className={`flex w-20 shrink-0 items-center justify-center text-sm font-bold text-white ${ACCENT_BG[accent]}`}
      >
        T{tier}
      </div>
      <div className="flex flex-1 flex-col justify-center px-4 py-3">
        <div className="text-sm font-semibold text-text">{label}</div>
        {members && <div className="mt-0.5 text-xs text-text-muted">{members}</div>}
      </div>
    </div>
  );
}
