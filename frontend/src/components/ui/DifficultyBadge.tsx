/**
 * @file Difficulty badge (platform-aware — BOJ tier / Programmers Lv.N)
 * @domain common
 * @layer component
 * @related Badge, constants, problems/page.tsx, DashboardTwoColumn
 */
'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import {
  type Difficulty,
  type SourcePlatform,
  DIFFICULTY_LABELS,
  PROGRAMMERS_LEVEL_LABELS,
  toTierLevel,
} from '@/lib/constants';

/** CSS variable-based difficulty colors — works in all environments */
const DIFF_STYLES: Record<Difficulty, { color: string; bg: string; border: string }> = {
  BRONZE:   { color: 'var(--diff-bronze-color)',   bg: 'var(--diff-bronze-bg)',   border: 'var(--diff-bronze-color)' },
  SILVER:   { color: 'var(--diff-silver-color)',   bg: 'var(--diff-silver-bg)',   border: 'var(--diff-silver-color)' },
  GOLD:     { color: 'var(--diff-gold-color)',     bg: 'var(--diff-gold-bg)',     border: 'var(--diff-gold-color)' },
  PLATINUM: { color: 'var(--diff-platinum-color)', bg: 'var(--diff-platinum-bg)', border: 'var(--diff-platinum-color)' },
  DIAMOND:  { color: 'var(--diff-diamond-color)',  bg: 'var(--diff-diamond-bg)',  border: 'var(--diff-diamond-color)' },
  RUBY:     { color: 'var(--diff-ruby-color)',     bg: 'var(--diff-ruby-bg)',     border: 'var(--diff-ruby-color)' },
};

/** Neutral fallback for Programmers Lv.0 (difficulty null) or mapping failure */
const NEUTRAL_STYLE = { color: 'var(--text-2)', bg: 'var(--bg-alt)', border: 'var(--border)' };

export interface DifficultyBadgeProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> {
  readonly difficulty: Difficulty | null;
  readonly level?: number | null;
  readonly sourcePlatform?: SourcePlatform | null;
  readonly showDot?: boolean;
  readonly showLabel?: boolean;
}

/**
 * Difficulty badge — branches label rules by platform.
 *
 * - BOJ (default): `DIFFICULTY_LABELS[difficulty]` + `toTierLevel(level)` → "Bronze 5" format
 * - PROGRAMMERS: `PROGRAMMERS_LEVEL_LABELS[level]` → "Lv.N" format
 *   Colors reuse the gateway `levelToDifficulty(Lv.1~5 → BRONZE~DIAMOND)` mapping.
 *   Neutral fallback applied for Lv.0 (difficulty null) or mapping failure.
 *
 * When `difficulty` is null in BOJ context, rendering is skipped (existing behavior).
 */
const DifficultyBadge = React.memo(function DifficultyBadge({
  className,
  difficulty,
  level,
  sourcePlatform,
  showDot = true,
  showLabel = true,
  style,
  ...props
}: DifficultyBadgeProps): React.ReactElement | null {
  const t = useTranslations('ui');
  const isProgrammers = sourcePlatform === 'PROGRAMMERS';

  if (isProgrammers) {
    const labelText = level != null ? (PROGRAMMERS_LEVEL_LABELS[level] ?? 'Lv.0') : 'Lv.0';
    const colors = difficulty ? (DIFF_STYLES[difficulty] ?? NEUTRAL_STYLE) : NEUTRAL_STYLE;
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
        aria-label={t('difficultyBadge.ariaLabel', { label: labelText })}
        {...props}
      >
        {showDot && (
          <span
            aria-hidden
            className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
            style={{ backgroundColor: colors.color }}
          />
        )}
        {showLabel && <span>{labelText}</span>}
      </span>
    );
  }

  // BOJ (or unspecified platform) — skip rendering when difficulty is absent
  if (!difficulty) return null;
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
      aria-label={t('difficultyBadge.ariaLabel', { label: `${label}${tier}` })}
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
