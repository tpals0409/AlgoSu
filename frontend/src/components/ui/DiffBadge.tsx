/**
 * @file 난이도 뱃지 (solved.ac 6티어 + Unrated)
 * @domain problem
 * @layer component
 */

import type { ReactElement } from 'react';
import { cn } from '@/lib/utils';

type DiffTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'ruby' | 'unrated';

interface DiffBadgeProps {
  readonly tier: DiffTier;
  readonly level?: number | null;
  readonly className?: string;
}

const TIER_LABELS: Record<DiffTier, string> = {
  bronze: '브론즈',
  silver: '실버',
  gold: '골드',
  platinum: '플래티넘',
  diamond: '다이아',
  ruby: '루비',
  unrated: 'Unrated',
};

const TIER_STYLES: Record<DiffTier, string> = {
  bronze: 'bg-diff-bronze-bg text-diff-bronze border-diff-bronze-border',
  silver: 'bg-diff-silver-bg text-diff-silver border-diff-silver-border',
  gold: 'bg-diff-gold-bg text-diff-gold border-diff-gold-border',
  platinum: 'bg-diff-platinum-bg text-diff-platinum border-diff-platinum-border',
  diamond: 'bg-diff-diamond-bg text-diff-diamond border-diff-diamond-border',
  ruby: 'bg-diff-ruby-bg text-diff-ruby border-diff-ruby-border',
  unrated: 'bg-muted-soft text-muted border-muted',
};

export function DiffBadge({ tier, level, className }: DiffBadgeProps): ReactElement {
  const label = level ? `${TIER_LABELS[tier]} ${level}` : TIER_LABELS[tier];

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm border px-2.5 py-0.5 text-[11px] font-semibold leading-none tracking-wide',
        TIER_STYLES[tier],
        className,
      )}
    >
      {label}
    </span>
  );
}
