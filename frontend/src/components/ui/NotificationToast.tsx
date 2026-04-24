/**
 * @file Notification toast portal (10 notification types + auto-dismiss)
 * @domain notification
 * @layer component
 * @related NotificationBell, Toast, notificationApi
 */
'use client';

import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { createPortal } from 'react-dom';
import { useRouter } from '@/i18n/navigation';
import {
  Bell,
  FileText,
  Brain,
  AlertTriangle,
  Users,
  BookOpen,
  Clock,
  UserPlus,
  UserMinus,
  Lock,
  CheckCircle,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { isSafeInternalPath } from '@/lib/url';
import type { Notification } from '@/lib/api';

const TYPE_ICON: Record<string, typeof Bell> = {
  SUBMISSION_STATUS: FileText,
  AI_COMPLETED: Brain,
  GITHUB_FAILED: AlertTriangle,
  ROLE_CHANGED: Users,
  PROBLEM_CREATED: BookOpen,
  DEADLINE_REMINDER: Clock,
  MEMBER_JOINED: UserPlus,
  MEMBER_LEFT: UserMinus,
  STUDY_CLOSED: Lock,
  FEEDBACK_RESOLVED: CheckCircle,
};

interface ToastItem {
  notification: Notification;
  visible: boolean;
}

interface NotificationToastProps {
  readonly notification: Notification | null;
  readonly onDismiss: () => void;
  readonly onRead: (id: string) => void;
}

export function NotificationToast({
  notification,
  onDismiss,
  onRead,
}: NotificationToastProps): ReactNode {
  const t = useTranslations('ui');
  const router = useRouter();
  const [toast, setToast] = useState<ToastItem | null>(null);
  const onDismissRef = useRef(onDismiss);
  const onReadRef = useRef(onRead);
  onDismissRef.current = onDismiss;
  onReadRef.current = onRead;
  const lastNotificationIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!notification) return;
    // Prevent duplicate notification display
    if (notification.id === lastNotificationIdRef.current) return;
    lastNotificationIdRef.current = notification.id;

    // Show new notification
    setToast({ notification, visible: false });

    // Start slide-in animation on next frame
    const showTimer = setTimeout(() => {
      setToast((prev) => /* istanbul ignore next -- defensive null guard */ (prev ? { ...prev, visible: true } : null));
    }, 50);

    // Auto-close after 4 seconds
    const hideTimer = setTimeout(() => {
      setToast((prev) => /* istanbul ignore next -- defensive null guard */ (prev ? { ...prev, visible: false } : null));
      setTimeout(() => {
        setToast(null);
        onDismissRef.current();
      }, 300);
    }, 4000);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [notification]);

  const handleClick = useCallback(() => {
    setToast((prev) => {
      /* istanbul ignore next -- unreachable: component returns null when toast is null */
      if (!prev) return null;
      const { id, link } = prev.notification;
      onReadRef.current(id);
      setTimeout(() => {
        setToast(null);
        onDismissRef.current();
        if (link && isSafeInternalPath(link)) router.push(link);
      }, 300);
      return { ...prev, visible: false };
    });
  }, [router]);

  const handleClose = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setToast((prev) => /* istanbul ignore next -- defensive null guard */ (prev ? { ...prev, visible: false } : null));
      setTimeout(() => {
        setToast(null);
        onDismissRef.current();
      }, 300);
    },
    [],
  );

  if (!toast) return null;

  const Icon = TYPE_ICON[toast.notification.type] ?? Bell;

  return createPortal(
    <div className="fixed bottom-0 right-0 z-[100] flex justify-end pointer-events-none px-4 pb-6">
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => { if (e.key === 'Enter') handleClick(); }}
        className={cn(
          'pointer-events-auto flex w-full max-w-sm items-start gap-3',
          'rounded-card border border-border bg-bg-card px-4 py-3',
          'shadow-modal cursor-pointer',
          'transition-all duration-300 ease-out',
          toast.visible
            ? 'translate-y-0 opacity-100'
            : 'translate-y-full opacity-0',
        )}
      >
        <div
          className="mt-0.5 flex shrink-0 items-center justify-center rounded-md bg-primary-soft2 w-7 h-7"
        >
          <Icon className="h-3.5 w-3.5 text-primary" aria-hidden />
        </div>

        <div className="min-w-0 flex-1 text-left">
          <p className="text-[12px] font-medium text-text">
            {toast.notification.title}
          </p>
          <p className="mt-0.5 text-[11px] text-text-3 line-clamp-2">
            {toast.notification.message}
          </p>
        </div>

        <button
          type="button"
          onClick={handleClose}
          className="mt-0.5 shrink-0 text-text-3 hover:text-text transition-colors"
          aria-label={t('notificationToast.close')}
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </div>,
    document.body,
  );
}
