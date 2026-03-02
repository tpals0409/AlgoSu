/**
 * @file 알림 토스트 포탈 (9종 알림 타입 + 자동 소멸)
 * @domain notification
 * @layer component
 * @related NotificationBell, Toast, notificationApi
 */
'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  Bell,
  FileText,
  Brain,
  AlertTriangle,
  Users,
  BookOpen,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Notification } from '@/lib/api';

const TYPE_ICON: Record<string, typeof Bell> = {
  SUBMISSION_STATUS: FileText,
  AI_COMPLETED: Brain,
  GITHUB_FAILED: AlertTriangle,
  ROLE_CHANGED: Users,
  PROBLEM_CREATED: BookOpen,
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
  const router = useRouter();
  const [toast, setToast] = useState<ToastItem | null>(null);

  useEffect(() => {
    if (!notification) return;

    // 새 알림 표시
    setToast({ notification, visible: false });

    // 다음 프레임에서 slide-in 애니메이션 시작
    const showTimer = setTimeout(() => {
      setToast((prev) => (prev ? { ...prev, visible: true } : null));
    }, 50);

    // 4초 후 자동 닫기
    const hideTimer = setTimeout(() => {
      setToast((prev) => (prev ? { ...prev, visible: false } : null));
      setTimeout(() => {
        setToast(null);
        onDismiss();
      }, 300);
    }, 4000);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [notification, onDismiss]);

  const handleClick = useCallback(() => {
    if (!toast) return;
    const { id, link } = toast.notification;
    onRead(id);
    setToast((prev) => (prev ? { ...prev, visible: false } : null));
    setTimeout(() => {
      setToast(null);
      onDismiss();
      if (link) router.push(link);
    }, 300);
  }, [toast, onDismiss, onRead, router]);

  const handleClose = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setToast((prev) => (prev ? { ...prev, visible: false } : null));
      setTimeout(() => {
        setToast(null);
        onDismiss();
      }, 300);
    },
    [onDismiss],
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
          className="mt-0.5 flex shrink-0 items-center justify-center rounded-md bg-primary-soft2"
          style={{ width: '28px', height: '28px' }}
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
          aria-label="닫기"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>,
    document.body,
  );
}
