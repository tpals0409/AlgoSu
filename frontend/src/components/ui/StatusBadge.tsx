/**
 * @file Status badge (in progress / closed / analysis complete / analyzing etc.)
 * @domain common
 * @layer component
 */

import React, { type ReactElement } from 'react';
import { cn } from '@/lib/utils';

type StatusVariant = 'success' | 'warning' | 'error' | 'info' | 'muted';

interface StatusBadgeProps {
  readonly label: string;
  readonly variant?: StatusVariant;
  readonly className?: string;
}

const VARIANT_STYLES: Record<StatusVariant, string> = {
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  error: 'bg-error-soft text-error',
  info: 'bg-info-soft text-info',
  muted: 'bg-muted-soft text-muted',
};

export const StatusBadge = React.memo(function StatusBadge({
  label,
  variant = 'muted',
  className,
}: StatusBadgeProps): ReactElement {
  return (
    <span
      role="status"
      className={cn(
        'inline-flex items-center rounded-badge px-2.5 py-0.5 text-[11px] font-medium leading-none',
        VARIANT_STYLES[variant],
        className,
      )}
    >
      {label}
    </span>
  );
});
