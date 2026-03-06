/**
 * @file 범용 상태 뱃지 컴포넌트
 * @domain common
 * @layer component
 * @related DiffBadge, StatusBadge, ScoreBadge, LangBadge
 */

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// ─── VARIANTS ────────────────────────────────

const badgeVariants = cva(
  [
    'inline-flex items-center gap-1',
    'text-[11px] font-medium leading-none',
    'px-2.5 py-0.5 rounded-badge',
    'whitespace-nowrap transition-colors duration-150',
  ],
  {
    variants: {
      variant: {
        default: 'bg-primary-soft text-primary',
        info:    'bg-info-soft text-info',
        success: 'bg-success-soft text-success',
        warning: 'bg-warning-soft text-warning',
        error:   'bg-error-soft text-error',
        muted:   'bg-muted-soft text-muted',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

// ─── TYPES ───────────────────────────────────

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** true 일 때 텍스트 앞에 currentColor dot 표시 */
  readonly dot?: boolean;
}

// ─── RENDER ──────────────────────────────────

/**
 * 범용 뱃지 컴포넌트 (상태/정보 표시)
 * @domain common
 */
const Badge = React.memo(function Badge({ className, variant, dot, children, ...props }: BadgeProps): React.ReactElement {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && (
        <span
          className="inline-block shrink-0 rounded-full bg-current w-[5px] h-[5px]"
          aria-hidden
        />
      )}
      {children}
    </span>
  );
});

export { Badge, badgeVariants };
