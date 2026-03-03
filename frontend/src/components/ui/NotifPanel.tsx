/**
 * @file 알림 드롭다운 패널 (v2 디자인 시스템)
 * @domain notification
 * @layer component
 * @related NotificationBell, notificationApi
 *
 * 9종 알림 타입별 아이콘/색상 분기.
 * 미읽음 표시, 전체 읽음 버튼, 빈상태 처리.
 */

import type { ReactElement, ReactNode } from 'react';
import type { Notification } from '@/lib/api';
import { cn } from '@/lib/utils';

// ─── TYPES ───────────────────────────────

interface NotifPanelProps {
  readonly open: boolean;
  readonly notifications: Notification[];
  readonly onMarkAllRead?: () => void;
  readonly onClickNotif?: (notification: Notification) => void;
  readonly className?: string;
}

type NotifType = 'success' | 'error' | 'warning' | 'info' | 'ai';

// ─── CONSTANTS ───────────────────────────

/** 9종 알림 타입 → 시각 분류 매핑 */
const TYPE_MAP: Record<string, NotifType> = {
  SUBMISSION_STATUS: 'success',
  AI_COMPLETED: 'ai',
  GITHUB_FAILED: 'error',
  ROLE_CHANGED: 'info',
  PROBLEM_CREATED: 'info',
  DEADLINE_REMINDER: 'warning',
  MEMBER_JOINED: 'success',
  MEMBER_LEFT: 'warning',
  STUDY_CLOSED: 'error',
};

/** 시각 분류별 Tailwind 스타일 */
const STYLE_MAP: Record<NotifType, string> = {
  success: 'bg-success-soft text-success border-l-success',
  error: 'bg-error-soft text-error border-l-error',
  warning: 'bg-warning-soft text-warning border-l-warning',
  info: 'bg-info-soft text-info border-l-info',
  ai: 'bg-primary-soft text-primary border-l-primary',
};

// ─── HELPERS ─────────────────────────────

/**
 * 상대 시간 포맷
 * @domain common
 */
function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

// ─── RENDER ──────────────────────────────

/**
 * 알림 패널 드롭다운
 * @domain notification
 */
export function NotifPanel({
  open,
  notifications,
  onMarkAllRead,
  onClickNotif,
  className,
}: NotifPanelProps): ReactElement | null {
  if (!open) return null;

  const unread = notifications.filter((n) => !n.read);

  return (
    <div
      className={cn(
        'absolute right-0 top-[calc(100%+8px)] z-50 w-[360px] overflow-hidden rounded-card border border-border bg-bg-card shadow-hover',
        className,
      )}
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-sm font-semibold text-text">알림</span>
        <span className="rounded-badge bg-primary-soft px-2.5 py-0.5 text-[10px] font-medium text-primary">
          {unread.length}개 미읽음
        </span>
      </div>

      {/* 알림 목록 */}
      <div className="max-h-[380px] overflow-auto">
        {unread.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-text-3">
            새로운 알림이 없습니다
          </div>
        ) : (
          unread.map((n) => {
            const notifType = TYPE_MAP[n.type] ?? 'info';
            const style = STYLE_MAP[notifType];
            const borderClass = style.split(' ').pop() ?? '';
            const badgeClasses = style
              .split(' ')
              .slice(0, 2)
              .join(' ');
            return (
              <div
                key={n.id}
                role="button"
                tabIndex={0}
                onClick={() => onClickNotif?.(n)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onClickNotif?.(n);
                }}
                className={cn(
                  'flex cursor-pointer gap-2.5 border-b border-l-[3px] border-border px-4 py-3 transition-colors hover:bg-bg-alt',
                  borderClass,
                )}
              >
                <div
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                    badgeClasses,
                  )}
                >
                  <NotifIcon type={notifType} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-text">
                    {n.title}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-text-2">
                    {n.message}
                  </p>
                  <p className="mt-1 text-[10px] text-text-3">
                    {formatRelativeTime(n.createdAt)}
                  </p>
                </div>
                <div className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
              </div>
            );
          })
        )}
      </div>

      {/* 모두 읽음 버튼 */}
      {unread.length > 0 && (
        <div className="border-t border-border px-4 py-2.5 text-center">
          <button
            type="button"
            onClick={onMarkAllRead}
            className="border-none bg-transparent text-xs font-medium text-primary transition-colors hover:underline"
          >
            모든 알림 읽음 처리
          </button>
        </div>
      )}
    </div>
  );
}

// ─── ICON COMPONENT ──────────────────────

/**
 * 알림 유형별 SVG 아이콘
 * @domain notification
 */
function NotifIcon({ type }: { readonly type: NotifType }): ReactNode {
  const props = {
    width: 14,
    height: 14,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    'aria-hidden': true as const,
  };

  switch (type) {
    case 'success':
      return (
        <svg {...props} strokeWidth={2}>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      );
    case 'error':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      );
    case 'warning':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
    case 'info':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      );
    case 'ai':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v4m0 14v4M4.22 4.22l2.83 2.83m9.9 9.9l2.83 2.83M1 12h4m14 0h4M4.22 19.78l2.83-2.83m9.9-9.9l2.83-2.83" />
        </svg>
      );
  }
}
