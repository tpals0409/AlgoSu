/**
 * @file 입력 필드 컴포넌트 (v2 디자인 시스템)
 * @domain common
 * @layer component
 * @related Button, Card
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

// ─── TYPES ───────────────────────────────────

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  readonly label?: string;
  readonly error?: string;
  readonly hint?: string;
}

// ─── RENDER ──────────────────────────────────

/**
 * 입력 필드 (v2 input-bg + focus primary)
 * @domain common
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, disabled, ...props }, ref) => {
    const inputId =
      id ?? (label ? `input-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);
    const errorId = error ? `${inputId}-error` : undefined;
    const hintId = hint && !error ? `${inputId}-hint` : undefined;

    return (
      <div className="flex flex-col">
        {label && (
          <label
            htmlFor={inputId}
            className={cn(
              'text-[11px] font-medium text-text2 mb-[5px]',
              disabled && 'opacity-50',
            )}
          >
            {label}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId ?? hintId}
          className={cn(
            'w-full px-3 py-2 rounded-badge border border-border',
            'bg-input-bg text-text text-xs',
            'outline-none transition-[border-color] duration-150',
            'placeholder:text-text3',
            'focus:border-primary',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-error focus:border-error',
            className,
          )}
          style={{ padding: '8px 12px', fontSize: '12px' }}
          {...props}
        />
        {error && (
          <p id={errorId} role="alert" className="mt-1 text-[11px] text-error">
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={hintId} className="mt-1 text-[11px] text-text3">
            {hint}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';

export { Input };
