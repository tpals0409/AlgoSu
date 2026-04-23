/**
 * @file Loading spinner component (sm/md/lg sizes)
 * @domain common
 * @layer component
 * @related Skeleton
 */
'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const spinnerVariants = cva(
  ['inline-block rounded-full border-2', 'border-current border-t-transparent', 'animate-spin-slow'],
  {
    variants: {
      size: {
        sm: 'h-4 w-4 border-[1.5px]',
        md: 'h-6 w-6 border-2',
        lg: 'h-10 w-10 border-[3px]',
        xl: 'h-16 w-16 border-4',
      },
      color: {
        primary: 'text-primary',
        muted:   'text-text-3',
        white:   'text-white',
        current: 'text-current',
      },
    },
    defaultVariants: { size: 'md', color: 'primary' },
  },
);

export interface LoadingSpinnerProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'color'>,
    VariantProps<typeof spinnerVariants> {
  readonly label?: string;
}

const LoadingSpinner = React.memo(function LoadingSpinner({ className, size, color, label, ...props }: LoadingSpinnerProps): React.ReactElement {
  const t = useTranslations('ui');
  const resolvedLabel = label ?? t('loadingSpinner.loading');
  return (
    <span role="status" aria-label={resolvedLabel} className={cn('inline-flex items-center justify-center', className)} {...props}>
      <span aria-hidden="true" className={cn(spinnerVariants({ size, color }))} />
      <span className="sr-only">{resolvedLabel}</span>
    </span>
  );
});

const FullscreenSpinner = React.memo(function FullscreenSpinner({ label }: { readonly label?: string }): React.ReactElement {
  const t = useTranslations('ui');
  const resolvedLabel = label ?? t('loadingSpinner.loading');
  return (
    <div
      role="status"
      aria-label={resolvedLabel}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-bg/80 backdrop-blur-sm"
    >
      <LoadingSpinner size="xl" label={resolvedLabel} />
      <p className="text-sm font-medium text-text-3">{resolvedLabel}</p>
    </div>
  );
});

const InlineSpinner = React.memo(function InlineSpinner({ className }: { readonly className?: string }): React.ReactElement {
  const t = useTranslations('ui');
  return <LoadingSpinner size="sm" color="current" className={className} label={t('loadingSpinner.processing')} />;
});

export { LoadingSpinner, FullscreenSpinner, InlineSpinner };
