import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Input — AlgoSu UI Design System
 *
 * 목업 form-input 스펙:
 *  padding: 8px 12px; border-radius: 6px; border: 1px solid border-color;
 *  font-size: 12px; font-family: inherit; outline: none;
 *  transition: border-color 0.15s;
 *  light: bg bg2; color text;
 *  dark:  bg bg2 (다크모드 bg2=#27233A, card=#231F34 → 명도 차 확보)
 *  focus: border-color main;
 *  label: font-size 11px; font-weight 500; color text2; margin-bottom 5px;
 */

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  readonly label?: string;
  readonly error?: string;
  readonly hint?: string;
}

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
            'w-full px-3 py-2 rounded-btn border border-border',
            'bg-bg2 text-text1 text-xs font-[inherit]',
            'outline-none transition-[border-color] duration-150',
            'placeholder:text-text3',
            'focus:border-primary-500',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-destructive focus:border-destructive',
            className,
          )}
          style={{ padding: '8px 12px', fontSize: '12px' }}
          {...props}
        />
        {error && (
          <p id={errorId} role="alert" className="mt-1 text-[11px] text-[var(--color-error)]">
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
