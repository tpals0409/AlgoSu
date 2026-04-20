/**
 * @file 난이도 뱃지 (플랫폼 인지형 — BOJ 티어 / 프로그래머스 Lv.N)
 * @domain common
 * @layer component
 * @related Badge, constants, problems/page.tsx, DashboardTwoColumn
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  type Difficulty,
  type SourcePlatform,
  DIFFICULTY_LABELS,
  PROGRAMMERS_LEVEL_LABELS,
  toTierLevel,
} from '@/lib/constants';

/** CSS 변수 기반 난이도 색상 — 모든 환경에서 동작 */
const DIFF_STYLES: Record<Difficulty, { color: string; bg: string; border: string }> = {
  BRONZE:   { color: 'var(--diff-bronze-color)',   bg: 'var(--diff-bronze-bg)',   border: 'var(--diff-bronze-color)' },
  SILVER:   { color: 'var(--diff-silver-color)',   bg: 'var(--diff-silver-bg)',   border: 'var(--diff-silver-color)' },
  GOLD:     { color: 'var(--diff-gold-color)',     bg: 'var(--diff-gold-bg)',     border: 'var(--diff-gold-color)' },
  PLATINUM: { color: 'var(--diff-platinum-color)', bg: 'var(--diff-platinum-bg)', border: 'var(--diff-platinum-color)' },
  DIAMOND:  { color: 'var(--diff-diamond-color)',  bg: 'var(--diff-diamond-bg)',  border: 'var(--diff-diamond-color)' },
  RUBY:     { color: 'var(--diff-ruby-color)',     bg: 'var(--diff-ruby-bg)',     border: 'var(--diff-ruby-color)' },
};

/** 프로그래머스 Lv.0(difficulty null) 또는 매핑 실패 시 neutral fallback */
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
 * 난이도 뱃지 — 플랫폼에 따라 라벨 규칙을 분기한다.
 *
 * - BOJ(기본): `DIFFICULTY_LABELS[difficulty]` + `toTierLevel(level)` → "Bronze 5" 형식
 * - PROGRAMMERS: `PROGRAMMERS_LEVEL_LABELS[level]` → "Lv.N" 형식
 *   색상은 gateway `levelToDifficulty(Lv.1~5 → BRONZE~DIAMOND)` 매핑을 재사용한다.
 *   Lv.0(difficulty null) 또는 매핑 실패 시 neutral fallback 적용.
 *
 * BOJ 컨텍스트에서 `difficulty`가 null이면 렌더링을 생략한다(기존 동작 유지).
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
        aria-label={`난이도: ${labelText}`}
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

  // BOJ(또는 플랫폼 미지정) — difficulty가 없으면 렌더링 생략
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
