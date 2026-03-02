/**
 * @file 알림 Alert 컴포넌트 (success/error/warning/info)
 * @domain common
 * @layer component
 * @related Toast, NotificationToast
 */
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const alertVariants = cva(
  ['relative flex gap-3 rounded-lg border p-4', 'text-sm', '[&>svg]:mt-0.5 [&>svg]:shrink-0'],
  {
    variants: {
      variant: {
        success: 'border-success/30 bg-success/10 text-success [&>svg]:text-success',
        error:   'border-destructive/30 bg-destructive/10 text-destructive [&>svg]:text-destructive',
        warning: 'border-warning/30 bg-warning/10 text-warning [&>svg]:text-warning',
        info:    'border-info/30 bg-info/10 text-info [&>svg]:text-info',
      },
    },
    defaultVariants: { variant: 'info' },
  },
);

const ALERT_ICONS = {
  success: CheckCircle2,
  error:   XCircle,
  warning: AlertTriangle,
  info:    Info,
} as const;

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  readonly title?: string;
  readonly onClose?: () => void;
}

function Alert({ className, variant = 'info', title, onClose, children, ...props }: AlertProps): React.ReactElement {
  const Icon = ALERT_ICONS[variant ?? 'info'];

  return (
    <div role="alert" className={cn(alertVariants({ variant }), className)} {...props}>
      <Icon className="h-4 w-4" aria-hidden />
      <div className="flex-1 space-y-1">
        {title && <p className="font-semibold leading-none">{title}</p>}
        {children && <div className="leading-relaxed opacity-90">{children}</div>}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="알림 닫기"
          className="ml-auto -mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}

export { Alert, alertVariants };
