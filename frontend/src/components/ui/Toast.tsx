/**
 * @file 토스트 알림 (7유형, 프로그레스바, auto-dismiss)
 * @domain notification
 * @layer component
 *
 * 7유형: success, error, warning, info, ai, submit, deadline
 */

'use client';

import { useEffect, useState, useCallback, type ReactElement } from 'react';
import { cn } from '@/lib/utils';

type ToastType = 'success' | 'error' | 'warning' | 'info' | 'ai' | 'submit' | 'deadline';

export interface ToastData {
  id: number;
  type: ToastType;
  title: string;
  message?: string;
  action?: string;
  duration?: number;
  onAction?: () => void;
}

interface ToastProps {
  readonly toast: ToastData;
  readonly onDismiss: (id: number) => void;
}

const TYPE_STYLES: Record<ToastType, { border: string; badge: string }> = {
  success: { border: 'border-l-success', badge: 'bg-success-soft text-success' },
  error: { border: 'border-l-error', badge: 'bg-error-soft text-error' },
  warning: { border: 'border-l-warning', badge: 'bg-warning-soft text-warning' },
  info: { border: 'border-l-info', badge: 'bg-info-soft text-info' },
  ai: { border: 'border-l-primary', badge: 'bg-primary-soft text-primary' },
  submit: { border: 'border-l-success', badge: 'bg-success-soft text-success' },
  deadline: { border: 'border-l-error', badge: 'bg-error-soft text-error' },
};

export function Toast({ toast, onDismiss }: ToastProps): ReactElement {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const styles = TYPE_STYLES[toast.type];

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
  }, []);

  const handleDismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => onDismiss(toast.id), 300);
  }, [toast.id, onDismiss]);

  useEffect(() => {
    if (!toast.duration) return;
    const timer = setTimeout(handleDismiss, toast.duration);
    return () => clearTimeout(timer);
  }, [toast.duration, handleDismiss]);

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        'relative flex w-full max-w-[380px] items-start gap-2.5 overflow-hidden rounded-lg border border-border bg-bg-card p-3.5 shadow-toast transition-all duration-300 ease-bounce',
        'border-l-[3px]',
        styles.border,
        visible && !exiting ? 'translate-x-0 opacity-100' : 'translate-x-6 opacity-0',
      )}
    >
      <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', styles.badge)}>
        <ToastIcon type={toast.type} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-text">{toast.title}</p>
        {toast.message && (
          <p className="mt-0.5 text-xs leading-relaxed text-text-2">{toast.message}</p>
        )}
        {toast.action && (
          <button
            type="button"
            onClick={toast.onAction}
            className={cn('mt-2 flex items-center gap-1 border-none bg-transparent p-0 text-xs font-semibold', styles.badge.split(' ').pop())}
          >
            {toast.action}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="닫기"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm border-none bg-transparent text-text-3 transition-colors hover:text-text"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
      {toast.duration && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-border">
          <div
            className={cn('h-full opacity-50', styles.badge.split(' ')[0])}
            style={{
              ['--toast-duration' as string]: `${toast.duration}ms`,
              animation: `shrink ${toast.duration}ms linear forwards`,
            }}
          />
        </div>
      )}
    </div>
  );
}

function ToastIcon({ type }: { type: ToastType }): ReactElement {
  const props = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, 'aria-hidden': true as const };

  switch (type) {
    case 'success':
    case 'submit':
      return <svg {...props}><polyline points="20 6 9 17 4 12" /></svg>;
    case 'error':
      return <svg {...props}><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>;
    case 'warning':
      return <svg {...props} strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>;
    case 'info':
      return <svg {...props}><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>;
    case 'ai':
      return <svg {...props} strokeWidth={1.5}><circle cx="12" cy="12" r="3" /><path d="M12 1v4m0 14v4M4.22 4.22l2.83 2.83m9.9 9.9l2.83 2.83M1 12h4m14 0h4M4.22 19.78l2.83-2.83m9.9-9.9l2.83-2.83" /></svg>;
    case 'deadline':
      return <svg {...props} strokeWidth={1.5}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>;
  }
}
