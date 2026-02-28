import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Badge — AlgoSu UI Design System
 *
 * 목업 스펙:
 *  display: inline-flex; align-items: center; gap: 4px;
 *  font-size: 11px; font-weight: 500; padding: 3px 8px;
 *  border-radius: 20px; line-height: 1; border: none;
 *
 * variant 매핑:
 *   default/info  -> badge-main:   rgba(148,126,176,0.22) / --color-main
 *   success       -> badge-green:  rgba(80,200,120,0.22)  / --color-success
 *   warning       -> badge-yellow: rgba(255,200,60,0.22)  / --color-warning
 *   error         -> badge-red:    rgba(255,90,80,0.22)   / --color-error
 *   muted         -> badge-sub:    rgba(163,165,195,0.22) / --color-sub
 */

const badgeVariants = cva(
  [
    'inline-flex items-center gap-1',
    'text-[11px] font-medium leading-none',
    'px-2 py-[3px] rounded-[20px]',
    'transition-colors duration-150',
  ],
  {
    variants: {
      variant: {
        default: 'text-[var(--color-main)] bg-[rgba(148,126,176,0.22)]',
        info:    'text-[var(--color-main)] bg-[rgba(148,126,176,0.22)]',
        success: 'text-[var(--color-success)] bg-[rgba(80,200,120,0.22)]',
        warning: 'text-[var(--color-warning)] bg-[rgba(255,200,60,0.22)]',
        error:   'text-[var(--color-error)] bg-[rgba(255,90,80,0.22)]',
        muted:   'text-[var(--color-sub)] bg-[rgba(163,165,195,0.22)]',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** true 일 때 텍스트 앞에 currentColor dot 표시 */
  readonly dot?: boolean;
}

function Badge({ className, variant, dot, children, ...props }: BadgeProps): React.ReactElement {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && (
        <span
          className="inline-block shrink-0 rounded-full bg-current"
          style={{ width: '5px', height: '5px' }}
          aria-hidden
        />
      )}
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
