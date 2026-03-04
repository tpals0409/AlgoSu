/**
 * @file AI 점수 뱃지 (90+: green, 70+: yellow, <70: red)
 * @domain ai
 * @layer component
 */

import React, { type ReactElement } from 'react';
import { cn } from '@/lib/utils';

interface ScoreBadgeProps {
  readonly score: number;
  readonly className?: string;
}

function getVariant(score: number): string {
  if (score >= 90) return 'bg-success-soft text-success';
  if (score >= 70) return 'bg-warning-soft text-warning';
  return 'bg-error-soft text-error';
}

export const ScoreBadge = React.memo(function ScoreBadge({ score, className }: ScoreBadgeProps): ReactElement {
  return (
    <span
      aria-label={`AI 점수 ${score}점`}
      className={cn(
        'inline-flex items-center gap-1 rounded-badge px-2.5 py-0.5 font-mono text-[11px] font-semibold leading-none',
        getVariant(score),
        className,
      )}
    >
      {score}점
    </span>
  );
});
