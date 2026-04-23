/**
 * @file General-purpose status badge component
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
  /** When true, displays a currentColor dot before text */
  readonly dot?: boolean;
}

// ─── RENDER ──────────────────────────────────

/**
 * General-purpose badge component (status/info display)
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
