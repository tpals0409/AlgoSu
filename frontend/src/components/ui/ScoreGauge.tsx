/**
 * @file SVG circular score gauge (animated)
 * @domain ai
 * @layer component
 *
 * Uses useAnimVal for 0 -> score animation on viewport entry.
 */

'use client';

import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { useAnimVal } from '@/hooks/useAnimVal';
import { cn } from '@/lib/utils';

interface ScoreGaugeProps {
  readonly score: number;
  readonly size?: number;
  readonly className?: string;
  readonly label?: string;
}

function getColor(score: number): string {
  if (score >= 80) return 'var(--success)';
  if (score >= 50) return 'var(--warning)';
  return 'var(--error)';
}

/** Returns the i18n key suffix for the score grade label */
function getGradeKey(score: number): 'excellent' | 'average' | 'needsImprovement' {
  if (score >= 80) return 'excellent';
  if (score >= 50) return 'average';
  return 'needsImprovement';
}

export function ScoreGauge({
  score,
  size = 140,
  className,
  label,
}: ScoreGaugeProps): ReactElement {
  const t = useTranslations('ui');
  const [ref, animScore] = useAnimVal(score, 1200);
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (circumference * animScore) / 100;
  const color = getColor(score);

  return (
    <div
      ref={ref}
      className={cn('relative', className)}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={score}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={t('scoreGauge.ariaLabel', { score, label: t(`scoreGauge.${getGradeKey(score)}`) })}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-[stroke-dashoffset] duration-100 ease-linear"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-mono text-4xl font-bold tracking-tighter"
          style={{ color }}
        >
          {Math.round(animScore)}
        </span>
        <span className="mt-[-2px] text-xs font-medium text-text-3">
          {label ?? t(`scoreGauge.${getGradeKey(score)}`)}
        </span>
      </div>
    </div>
  );
}
