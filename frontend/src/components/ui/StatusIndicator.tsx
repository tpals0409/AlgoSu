/**
 * @file 상태 인디케이터 (도트 + 라벨, 5상태)
 * @domain common
 * @layer component
 * @related StatusBadge, Badge
 */
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export type StatusType = 'pending' | 'running' | 'success' | 'failed' | 'syncing';

const STATUS_LABELS: Record<StatusType, string> = {
  pending: '대기 중',
  running: '실행 중',
  success: '완료',
  failed:  '실패',
  syncing: '동기화 중',
};

const STATUS_DOT_CLASSES: Record<StatusType, string> = {
  pending: 'bg-muted',
  running: 'bg-info animate-pulse',
  success: 'bg-success',
  failed:  'bg-error',
  syncing: 'bg-warning animate-pulse',
};

const statusVariants = cva('inline-flex items-center gap-1.5 text-xs font-medium', {
  variants: {
    status: {
      pending: 'text-muted',
      running: 'text-info',
      success: 'text-success',
      failed:  'text-error',
      syncing: 'text-warning',
    },
    size: {
      sm: 'text-xs gap-1',
      md: 'text-xs gap-1.5',
      lg: 'text-sm gap-2',
    },
  },
  defaultVariants: { status: 'pending', size: 'md' },
});

const DOT_SIZE_CLASSES = { sm: 'h-1.5 w-1.5', md: 'h-2 w-2', lg: 'h-2.5 w-2.5' } as const;

export interface StatusIndicatorProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'>,
    VariantProps<typeof statusVariants> {
  readonly status: StatusType;
  readonly showLabel?: boolean;
  readonly customLabel?: string;
}

function StatusIndicator({ className, status, size = 'md', showLabel = true, customLabel, ...props }: StatusIndicatorProps): React.ReactElement {
  const label = customLabel ?? STATUS_LABELS[status];
  const dotSize = DOT_SIZE_CLASSES[size ?? 'md'];
  return (
    <span className={cn(statusVariants({ status, size }), className)} aria-label={`상태: ${label}`} role="status" {...props}>
      <span aria-hidden className={cn('inline-block rounded-full shrink-0', dotSize, STATUS_DOT_CLASSES[status])} />
      {showLabel && <span>{label}</span>}
    </span>
  );
}

export { StatusIndicator };
