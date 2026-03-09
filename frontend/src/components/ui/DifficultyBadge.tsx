/**
 * @file 난이도 뱃지 (색상 구분, solved.ac 티어 기반)
 * @domain common
 * @layer component
 * @related Badge, DiffBadge, constants
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import { type Difficulty, DIFFICULTY_LABELS, toTierLevel } from '@/lib/constants';

/** CSS 변수 기반 난이도 색상 — 모든 환경에서 동작 */
const DIFF_STYLES: Record<Difficulty, { color: string; bg: string; border: string }> = {
  BRONZE:   { color: 'var(--diff-bronze-color)',   bg: 'var(--diff-bronze-bg)',   border: 'var(--diff-bronze-color)' },
  SILVER:   { color: 'var(--diff-silver-color)',   bg: 'var(--diff-silver-bg)',   border: 'var(--diff-silver-color)' },
  GOLD:     { color: 'var(--diff-gold-color)',     bg: 'var(--diff-gold-bg)',     border: 'var(--diff-gold-color)' },
  PLATINUM: { color: 'var(--diff-platinum-color)', bg: 'var(--diff-platinum-bg)', border: 'var(--diff-platinum-color)' },
  DIAMOND:  { color: 'var(--diff-diamond-color)',  bg: 'var(--diff-diamond-bg)',  border: 'var(--diff-diamond-color)' },
  RUBY:     { color: 'var(--diff-ruby-color)',     bg: 'var(--diff-ruby-bg)',     border: 'var(--diff-ruby-color)' },
};

export interface DifficultyBadgeProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> {
  readonly difficulty: Difficulty;
  readonly level?: number | null;
  readonly showDot?: boolean;
  readonly showLabel?: boolean;
}

const DifficultyBadge = React.memo(function DifficultyBadge({ className, difficulty, level, showDot = true, showLabel = true, style, ...props }: DifficultyBadgeProps): React.ReactElement {
  const label = DIFFICULTY_LABELS[difficulty];
  const displayLevel = toTierLevel(level);
  const tier = displayLevel ? ` ${displayLevel}` : '';
  const colors = DIFF_STYLES[difficulty] ?? DIFF_STYLES.BRONZE;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5',
        'text-[11px] font-medium',
        className,
      )}
      style={{
        backgroundColor: colors.bg,
        color: colors.color,
        ...style,
      }}
      aria-label={`난이도: ${label}${tier}`}
      {...props}
    >
      {showDot && (
        <span
          aria-hidden
          className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
          style={{ backgroundColor: colors.color }}
        />
      )}
      {showLabel && <span>{label}{tier}</span>}
    </span>
  );
});

export { DifficultyBadge };
