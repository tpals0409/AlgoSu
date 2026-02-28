import * as React from 'react';
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
        muted:   'text-muted-foreground',
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

function LoadingSpinner({ className, size, color, label = '로딩 중...', ...props }: LoadingSpinnerProps): React.ReactElement {
  return (
    <span role="status" aria-label={label} className={cn('inline-flex items-center justify-center', className)} {...props}>
      <span aria-hidden="true" className={cn(spinnerVariants({ size, color }))} />
      <span className="sr-only">{label}</span>
    </span>
  );
}

function FullscreenSpinner({ label = '로딩 중...' }: { readonly label?: string }): React.ReactElement {
  return (
    <div
      role="status"
      aria-label={label}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background/80 backdrop-blur-sm"
    >
      <LoadingSpinner size="xl" label={label} />
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

function InlineSpinner({ className }: { readonly className?: string }): React.ReactElement {
  return <LoadingSpinner size="sm" color="current" className={className} label="처리 중..." />;
}

export { LoadingSpinner, FullscreenSpinner, InlineSpinner };
