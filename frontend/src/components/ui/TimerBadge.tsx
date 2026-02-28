'use client';

import * as React from 'react';
import { Clock, AlertCircle } from 'lucide-react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

type TimerUrgency = 'normal' | 'warning' | 'critical' | 'expired';

const timerVariants = cva(
  ['inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5', 'text-xs font-mono font-medium leading-none border', 'transition-colors duration-300'],
  {
    variants: {
      urgency: {
        normal:   'bg-muted text-foreground border-border',
        warning:  'bg-warning/10 text-warning border-warning/30',
        critical: 'bg-destructive/10 text-destructive border-destructive/30 animate-pulse',
        expired:  'bg-muted text-muted-foreground border-border line-through opacity-60',
      },
    },
    defaultVariants: { urgency: 'normal' },
  },
);

interface TimeRemaining {
  readonly days: number;
  readonly hours: number;
  readonly minutes: number;
  readonly seconds: number;
  readonly totalSeconds: number;
}

function getTimeRemaining(deadline: Date): TimeRemaining {
  const diff = Math.max(0, deadline.getTime() - Date.now());
  const totalSeconds = Math.floor(diff / 1000);
  return {
    days:    Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours:   Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((diff % (1000 * 60)) / 1000),
    totalSeconds,
  };
}

function getUrgency(totalSeconds: number): TimerUrgency {
  if (totalSeconds <= 0)            return 'expired';
  if (totalSeconds <= 3600)         return 'critical';
  if (totalSeconds <= 3600 * 6)     return 'warning';
  return 'normal';
}

function formatTime(r: TimeRemaining): string {
  if (r.totalSeconds <= 0) return '마감';
  if (r.days > 0)          return `${r.days}일 ${r.hours}시간`;
  if (r.hours > 0)         return `${r.hours}:${String(r.minutes).padStart(2, '0')}:${String(r.seconds).padStart(2, '0')}`;
  return `${String(r.minutes).padStart(2, '0')}:${String(r.seconds).padStart(2, '0')}`;
}

export interface TimerBadgeProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> {
  readonly deadline: Date;
  readonly showIcon?: boolean;
  readonly live?: boolean;
}

function TimerBadge({ className, deadline, showIcon = true, live = true, ...props }: TimerBadgeProps): React.ReactElement {
  const [remaining, setRemaining] = React.useState<TimeRemaining>(() => getTimeRemaining(deadline));

  React.useEffect(() => {
    if (!live || remaining.totalSeconds <= 0) return;
    const id = setInterval(() => {
      const next = getTimeRemaining(deadline);
      setRemaining(next);
      if (next.totalSeconds <= 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [deadline, live, remaining.totalSeconds]);

  const urgency = getUrgency(remaining.totalSeconds);
  const formattedTime = formatTime(remaining);
  const isExpired = urgency === 'expired';

  return (
    <span
      className={cn(timerVariants({ urgency }), className)}
      aria-label={isExpired ? '마감 종료' : `마감까지 ${formattedTime} 남음`}
      aria-live={live ? 'polite' : undefined}
      {...props}
    >
      {showIcon && (
        isExpired
          ? <AlertCircle className="h-3 w-3 shrink-0" aria-hidden />
          : <Clock className="h-3 w-3 shrink-0" aria-hidden />
      )}
      <span>{formattedTime}</span>
    </span>
  );
}

export { TimerBadge };
