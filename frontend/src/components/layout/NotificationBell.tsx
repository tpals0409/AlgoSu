/**
 * @file 알림 벨 (v2 디자인 시스템)
 * @domain notification
 * @layer component
 * @related NotificationToast, notificationApi, NotifPanel
 *
 * 10초 폴링으로 미읽음 수 체크, 증가 시 토스트 자동 표시.
 * 클릭 시 notification.link로 이동.
 * 9종 알림 타입 완전 대응 + "모두 읽음" 지원.
 */

'use client';

import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
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
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { notificationApi, type Notification } from '@/lib/api';
import { NotificationToast } from '@/components/ui/NotificationToast';

// ─── CONSTANTS ───────────────────────────

/** 알림 타입별 클릭 시 이동할 경로 (link 없는 경우 fallback) */
const TYPE_ROUTE: Record<string, string> = {
  ROLE_CHANGED: '/studies',
  SUBMISSION_STATUS: '/submissions',
  AI_COMPLETED: '/submissions',
  GITHUB_FAILED: '/submissions',
  PROBLEM_CREATED: '/problems',
  DEADLINE_REMINDER: '/problems',
  MEMBER_JOINED: '/studies',
  MEMBER_LEFT: '/studies',
  STUDY_CLOSED: '/studies',
};

/** 알림 타입별 아이콘 */
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
};

// ─── HELPERS ─────────────────────────────

/**
 * 상대 시간 포맷
 * @domain common
 */
function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return new Date(dateStr).toLocaleDateString('ko-KR');
}

// ─── RENDER ──────────────────────────────

/**
 * 알림 벨 + 드롭다운 패널 + 토스트
 * @domain notification
 */
export function NotificationBell(): ReactNode {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [toastNotification, setToastNotification] =
    useState<Notification | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const prevUnreadRef = useRef<number>(0);
  const initialLoadRef = useRef(true);

  // ─── HOOKS ─────────────────────────────

  /**
   * 미읽음 수 폴링 (10초마다) + 증가 시 토스트 표시
   * @domain notification
   */
  const fetchUnreadCount = useCallback(async () => {
    try {
      const { count } = await notificationApi.unreadCount();
      setUnreadCount(count);

      if (!initialLoadRef.current && count > prevUnreadRef.current) {
        const latest = await notificationApi.list();
        const newest = latest.find((n) => !n.read);
        if (newest) setToastNotification(newest);
      }

      initialLoadRef.current = false;
      prevUnreadRef.current = count;
    } catch {
      // 조용히 실패
    }
  }, []);

  useEffect(() => {
    void fetchUnreadCount();
    const interval = setInterval(() => void fetchUnreadCount(), 10000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  /**
   * 드롭다운 열 때 알림 목록 로드
   * @domain notification
   */
  const loadNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await notificationApi.list();
      setNotifications(data);
    } catch {
      // 조용히 실패
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * 벨 토글
   * @domain notification
   */
  const handleToggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      if (next) {
        void loadNotifications();
      }
      return next;
    });
  }, [loadNotifications]);

  // ─── HANDLERS ──────────────────────────

  /**
   * 개별 읽음 처리
   * @domain notification
   */
  const handleMarkRead = useCallback(async (notificationId: string) => {
    try {
      await notificationApi.markRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, read: true } : n,
        ),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // 조용히 실패
    }
  }, []);

  /**
   * 전체 읽음 처리
   * @domain notification
   */
  const handleMarkAllRead = useCallback(async () => {
    try {
      await notificationApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      // 조용히 실패
    }
  }, []);

  // 외부 클릭 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <>
      <div className="relative" ref={ref}>
        {/* 벨 버튼 */}
        <button
          type="button"
          aria-label={`알림 ${unreadCount > 0 ? `(${unreadCount}개 미읽음)` : ''}`}
          aria-haspopup="true"
          aria-expanded={open}
          onClick={handleToggle}
          className={cn(
            'relative flex items-center justify-center bg-bg-alt',
            'text-text-3 transition-colors',
            'hover:text-text',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          )}
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '6px',
          }}
        >
          <Bell className="h-3.5 w-3.5" aria-hidden />
          {unreadCount > 0 && (
            <span
              className="absolute -right-1 -top-1 flex items-center justify-center rounded-full bg-error text-white"
              style={{
                minWidth: '16px',
                height: '16px',
                fontSize: '9px',
                fontWeight: 700,
                padding: '0 4px',
              }}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* 드롭다운 */}
        {open && (
          <div
            className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-card border border-border bg-bg-card shadow-modal"
            role="menu"
            aria-label="알림 목록"
          >
            {/* 헤더 */}
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <span className="text-[12px] font-semibold text-text">알림</span>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => void handleMarkAllRead()}
                  className="text-[10px] font-medium text-primary hover:underline"
                >
                  모두 읽음
                </button>
              )}
            </div>

            {/* 알림 목록 */}
            <div className="max-h-80 overflow-y-auto">
              {isLoading && (
                <div className="space-y-2 p-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-14 animate-pulse rounded bg-muted-soft"
                    />
                  ))}
                </div>
              )}

              {!isLoading && notifications.length === 0 && (
                <div className="py-10 text-center">
                  <Bell
                    className="mx-auto h-6 w-6 text-text-3"
                    aria-hidden
                  />
                  <p className="mt-2 text-[11px] text-text-3">
                    새로운 알림이 없습니다
                  </p>
                </div>
              )}

              {!isLoading &&
                notifications.map((notification) => {
                  const Icon = TYPE_ICON[notification.type] ?? Bell;

                  return (
                    <button
                      key={notification.id}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        if (!notification.read) {
                          void handleMarkRead(notification.id);
                        }
                        const route =
                          notification.link ??
                          TYPE_ROUTE[notification.type];
                        if (route) {
                          setOpen(false);
                          router.push(route);
                        }
                      }}
                      className={cn(
                        'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors',
                        'border-b border-border last:border-b-0',
                        notification.read
                          ? 'bg-transparent'
                          : 'bg-primary-soft',
                        'hover:bg-bg-alt',
                      )}
                    >
                      <div
                        className={cn(
                          'mt-0.5 flex shrink-0 items-center justify-center rounded-md',
                          notification.read
                            ? 'bg-bg-alt'
                            : 'bg-primary-soft2',
                        )}
                        style={{ width: '28px', height: '28px' }}
                      >
                        <Icon
                          className={cn(
                            'h-3.5 w-3.5',
                            notification.read
                              ? 'text-text-3'
                              : 'text-primary',
                          )}
                          aria-hidden
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            'text-[12px] truncate',
                            notification.read
                              ? 'font-normal text-text'
                              : 'font-medium text-text',
                          )}
                        >
                          {notification.title}
                        </p>
                        <p className="mt-0.5 text-[11px] text-text-2 line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="mt-1 font-mono text-[9px] text-text-3">
                          {formatRelativeTime(notification.createdAt)}
                        </p>
                      </div>

                      {!notification.read && (
                        <span
                          className="mt-1.5 shrink-0 rounded-full bg-primary"
                          style={{ width: '6px', height: '6px' }}
                          aria-label="미읽음"
                        />
                      )}
                    </button>
                  );
                })}
            </div>
          </div>
        )}
      </div>

      {/* 하단 토스트 알림 */}
      <NotificationToast
        notification={toastNotification}
        onDismiss={() => setToastNotification(null)}
        onRead={(id) => void handleMarkRead(id)}
      />
    </>
  );
}
