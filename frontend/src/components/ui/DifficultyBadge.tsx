/**
 * @file 난이도 뱃지 (색상 구분, solved.ac 티어 기반)
 * @domain common
 * @layer component
 * @related Badge, DiffBadge, constants
 */
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { type Difficulty, DIFFICULTY_LABELS } from '@/lib/constants';

const difficultyBadgeVariants = cva(
  ['inline-flex items-center gap-1 rounded-sm px-2 py-0.5', 'text-xs font-semibold leading-none tracking-wide', 'border transition-colors duration-150'],
  {
    variants: {
      difficulty: {
        BRONZE:   'bg-diff-bronze/10 text-diff-bronze border-diff-bronze/30',
        SILVER:   'bg-diff-silver/10 text-diff-silver border-diff-silver/30',
        GOLD:     'bg-diff-gold/10 text-diff-gold border-diff-gold/30',
        PLATINUM: 'bg-diff-platinum/10 text-diff-platinum border-diff-platinum/30',
        DIAMOND:  'bg-diff-diamond/10 text-diff-diamond border-diff-diamond/30',
      },
    },
    defaultVariants: { difficulty: 'BRONZE' },
  },
);

const DIFFICULTY_DOT_CLASSES: Record<Difficulty, string> = {
  BRONZE:   'bg-diff-bronze',
  SILVER:   'bg-diff-silver',
  GOLD:     'bg-diff-gold',
  PLATINUM: 'bg-diff-platinum',
  DIAMOND:  'bg-diff-diamond',
};

export interface DifficultyBadgeProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'>,
    VariantProps<typeof difficultyBadgeVariants> {
  readonly difficulty: Difficulty;
  readonly level?: number | null;
  readonly showDot?: boolean;
  readonly showLabel?: boolean;
}

function DifficultyBadge({ className, difficulty, level, showDot = true, showLabel = true, ...props }: DifficultyBadgeProps): React.ReactElement {
  const label = DIFFICULTY_LABELS[difficulty];
  const tier = level && level > 0 ? ` ${5 - (level - 1) % 5}` : '';
  return (
    <span className={cn(difficultyBadgeVariants({ difficulty }), className)} aria-label={`난이도: ${label}${tier}`} {...props}>
      {showDot && <span aria-hidden className={cn('inline-block h-1.5 w-1.5 rounded-full', DIFFICULTY_DOT_CLASSES[difficulty])} />}
      {showLabel && <span>{label}{tier}</span>}
    </span>
  );
}

export { DifficultyBadge, difficultyBadgeVariants };
