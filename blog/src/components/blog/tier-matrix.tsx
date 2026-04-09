/**
 * @file       tier-matrix.tsx
 * @domain     blog
 * @layer      ui
 * @related    src/components/mdx-components.tsx
 *
 * 3-Tier 에이전트 매트릭스. Tier 라벨 컬럼 + 카드 영역 grid.
 * orchestration-structure / meet-the-agents / agent-orchestration-solo-dev에서 재사용.
 */
import type { ReactNode } from 'react';
import { getIcon, type IconName } from './icons';

interface TierMatrixProps {
  children: ReactNode;
}

interface TierMatrixRowProps {
  tier: 1 | 2 | 3;
  label: string;
  description?: string;
  accent: 1 | 2 | 3 | 4 | 5 | 6;
  children: ReactNode;
}

interface TierMatrixCellProps {
  name: string;
  role: string;
  icon: IconName | string;
  hint?: string;
}

const ACCENT_BG: Record<number, string> = {
  1: 'bg-accent-1',
  2: 'bg-accent-2',
  3: 'bg-accent-3',
  4: 'bg-accent-4',
  5: 'bg-accent-5',
  6: 'bg-accent-6',
};

const ACCENT_TEXT: Record<number, string> = {
  1: 'text-accent-1',
  2: 'text-accent-2',
  3: 'text-accent-3',
  4: 'text-accent-4',
  5: 'text-accent-5',
  6: 'text-accent-6',
};

const ACCENT_BORDER_L: Record<number, string> = {
  1: 'border-l-accent-1',
  2: 'border-l-accent-2',
  3: 'border-l-accent-3',
  4: 'border-l-accent-4',
  5: 'border-l-accent-5',
  6: 'border-l-accent-6',
};

export function TierMatrix({ children }: TierMatrixProps) {
  return (
    <div className="my-6 flex flex-col gap-3 not-prose">{children}</div>
  );
}

export function TierMatrixRow({
  tier,
  label,
  description,
  accent,
  children,
}: TierMatrixRowProps) {
  return (
    <div
      className={`overflow-hidden rounded-xl border border-l-4 bg-surface-elevated ${ACCENT_BORDER_L[accent]}`}
      style={{ borderColor: 'var(--border)' }}
    >
      <div className="flex items-stretch">
        {/* Tier 라벨 컬럼 */}
        <div
          className={`flex w-20 shrink-0 flex-col items-center justify-center px-2 py-3 text-white sm:w-24 ${ACCENT_BG[accent]}`}
        >
          <div className="text-[10px] font-bold uppercase tracking-wider opacity-90">
            Tier
          </div>
          <div className="text-2xl font-black leading-none">{tier}</div>
        </div>
        {/* 헤더 + 카드 영역 */}
        <div className="flex flex-1 flex-col gap-3 px-4 py-3">
          <div>
            <h4 className={`text-sm font-bold ${ACCENT_TEXT[accent]}`}>{label}</h4>
            {description && (
              <p className="mt-0.5 text-xs text-text-muted">{description}</p>
            )}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export function TierMatrixCell({ name, role, icon, hint }: TierMatrixCellProps) {
  const Icon = getIcon(icon);
  return (
    <div
      className="flex items-start gap-2 rounded-lg border bg-surface p-2.5"
      style={{ borderColor: 'var(--border)' }}
    >
      <span
        aria-hidden
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-muted text-text-muted"
      >
        {Icon && <Icon size={16} strokeWidth={2} />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="truncate text-sm font-bold text-text">{name}</span>
          <span className="text-[10px] text-text-subtle">{role}</span>
        </div>
        {hint && <p className="mt-0.5 text-[11px] leading-snug text-text-muted">{hint}</p>}
      </div>
    </div>
  );
}
