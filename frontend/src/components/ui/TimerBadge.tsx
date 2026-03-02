/**
 * @file 마감 타이머 뱃지 (4상태: normal/warning/critical/expired)
 * @domain problem
 * @layer component
 *
 * 시간 규칙 (PM 확정):
 * - < 1h: M분 (critical, error + pulse)
 * - 1h~24h: H시간 M분 (warning)
 * - >= 1d: Nd (normal, text2)
 * - 마감됨: 마감 (muted + 취소선)
 */

'use client';

import { useEffect, useState, type ReactElement } from 'react';
import { cn } from '@/lib/utils';

type TimerVariant = 'normal' | 'warning' | 'critical' | 'expired';

interface TimerState {
  label: string;
  variant: TimerVariant;
}

export interface TimerBadgeProps {
  readonly deadline: string | Date;
  readonly className?: string;
}

function computeState(deadline: string | Date): TimerState {
  const target = typeof deadline === 'string' ? new Date(deadline) : deadline;
  const remaining = target.getTime() - Date.now();

  if (remaining <= 0) {
    return { label: '마감', variant: 'expired' };
  }

  const minutes = Math.floor(remaining / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 60) {
    return { label: `${minutes}분`, variant: 'critical' };
  }
  if (hours < 24) {
    return { label: `${hours}시간 ${minutes % 60}분`, variant: 'warning' };
  }
  return { label: `${days}d`, variant: 'normal' };
}

const VARIANT_STYLES: Record<TimerVariant, string> = {
  normal: 'text-text-2',
  warning: 'text-warning',
  critical: 'text-error animate-pulse-dot',
  expired: 'text-muted line-through',
};

function TimerBadge({ deadline, className }: TimerBadgeProps): ReactElement {
  const [state, setState] = useState(() => computeState(deadline));

  useEffect(() => {
    const interval = setInterval(() => {
      setState(computeState(deadline));
    }, 30_000);
    return () => clearInterval(interval);
  }, [deadline]);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[11px] font-medium',
        VARIANT_STYLES[state.variant],
        className,
      )}
      aria-label={state.variant === 'expired' ? '마감 종료' : `마감까지 ${state.label} 남음`}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
      {state.label}
    </span>
  );
}

export { TimerBadge };
