/**
 * @file 알림 벨 (v2 디자인 시스템)
 * @domain notification
 * @layer component
 * @related NotificationToast, notificationApi, NotifPanel
 *
 * SWR refreshInterval 60초 폴링으로 미읽음 수 체크.
 * 패널 열렸을 때만 알림 목록 fetch (conditional key).
 * SSE/mutation 후 mutate()로 즉시 갱신.
 * 클릭 시 notification.link로 이동.
 * 10종 알림 타입 완전 대응 + "모두 읽음" 지원.
 */

'use client';

import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import useSWR, { useSWRConfig } from 'swr';
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
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { notificationApi, type Notification } from '@/lib/api';
import { cacheKeys } from '@/lib/swr';
import { NotificationToast } from '@/components/ui/NotificationToast';
import { useNotificationSSE } from '@/hooks/useNotificationSSE';

// ─── CONSTANTS ───────────────────────────

const MAX_NOTIFICATIONS = 50;

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
  FEEDBACK_RESOLVED: '/feedbacks',
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
  FEEDBACK_RESOLVED: CheckCircle,
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
export function NotificationBell(props?: { placement?: 'sidebar' | 'header' }): ReactNode {
  const placement = props?.placement ?? 'sidebar';
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [toastNotification, setToastNotification] =
    useState<Notification | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);
  const displayedToastIds = useRef(new Set<string>());
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});

  // ─── SWR ───────────────────────────────

  const { mutate } = useSWRConfig();

  /**
   * 미읽음 수 — 60초 refreshInterval (SSE fallback)
   * @domain notification
   */
  const { data: unreadData } = useSWR<{ count: number }>(
    cacheKeys.notifications.unreadCount(),
    { refreshInterval: 60_000 },
  );
  const unreadCount = unreadData?.count ?? 0;

  /**
   * 알림 목록 — 패널 열렸을 때만 fetch (conditional key)
   * @domain notification
   */
  const { data: notificationsData, isLoading } = useSWR<Notification[]>(
    open ? cacheKeys.notifications.list() : null,
  );
  const notifications = notificationsData?.slice(0, MAX_NOTIFICATIONS) ?? [];

  // ─── HOOKS ─────────────────────────────

  /**
   * SSE 실시간 알림 수신 — 새 알림 도착 시 SWR 캐시 즉시 갱신 + 토스트 (중복 방지)
   * @domain notification
   */
  const handleSSENotification = useCallback(
    (notification: Notification) => {
      if (notification.read) return;
      if (displayedToastIds.current.has(notification.id)) return;
      displayedToastIds.current.add(notification.id);
      void mutate(cacheKeys.notifications.unreadCount());
      void mutate(cacheKeys.notifications.list());
      setToastNotification(notification);
    },
    [mutate],
  );

  const { sseDisconnected } = useNotificationSSE(true, handleSSENotification);

  /**
   * 벨 토글
   * @domain notification
   */
  const handleToggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      if (next) {
        // 벨 버튼 기준으로 패널 위치 계산 (fixed)
        if (bellRef.current) {
          const rect = bellRef.current.getBoundingClientRect();
          const isDesktop = window.innerWidth >= 768; // md breakpoint
          if (placement === 'sidebar') {
            setPanelStyle({
              position: 'fixed',
              bottom: window.innerHeight - rect.top + 8,
              ...(isDesktop
                ? { left: rect.left }                          // 데스크탑: 사이드바 왼쪽 → 오른쪽으로 펼침
                : { right: window.innerWidth - rect.right }),  // 모바일: 사이드바 오른쪽 → 왼쪽으로 펼침
            });
          } else {
            // 헤더: 버튼 아래쪽으로 열림, 오른쪽 정렬
            setPanelStyle({
              position: 'fixed',
              top: rect.bottom + 8,
              right: window.innerWidth - rect.right,
            });
          }
        }
      }
      return next;
    });
  }, [placement]);

  // ─── HANDLERS ──────────────────────────

  /**
   * 개별 읽음 처리 — API 호출 후 SWR 캐시 갱신
   * @domain notification
   */
  const handleMarkRead = useCallback(
    async (notificationId: string) => {
      try {
        await notificationApi.markRead(notificationId);
        void mutate(cacheKeys.notifications.unreadCount());
        void mutate(cacheKeys.notifications.list());
      } catch {
        // 조용히 실패
      }
    },
    [mutate],
  );

  /**
   * 전체 읽음 처리 — API 호출 후 SWR 캐시 갱신
   * @domain notification
   */
  const handleMarkAllRead = useCallback(async () => {
    try {
      await notificationApi.markAllRead();
      void mutate(cacheKeys.notifications.unreadCount());
      void mutate(cacheKeys.notifications.list());
    } catch {
      // 조용히 실패
    }
  }, [mutate]);

  const handleToastDismiss = useCallback(() => setToastNotification(null), []);
  const handleToastRead = useCallback((id: string) => void handleMarkRead(id), [handleMarkRead]);

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
      <div ref={ref}>
        {/* 벨 버튼 */}
        {placement === 'sidebar' ? (
          <button
            ref={bellRef}
            type="button"
            onClick={handleToggle}
            aria-label={`알림 ${unreadCount > 0 ? `(${unreadCount}개 미읽음)` : ''}${sseDisconnected ? ' (실시간 연결 끊김)' : ''}`}
            aria-haspopup="true"
            aria-expanded={open}
            title={sseDisconnected ? '실시간 알림 연결이 끊어졌습니다. 60초마다 갱신됩니다.' : undefined}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-btn px-3 py-2 text-[13px] font-medium transition-all duration-150',
              open
                ? 'bg-primary-soft text-primary'
                : 'text-text-3 hover:bg-bg-alt hover:text-text-2',
            )}
          >
            <span className="relative shrink-0">
              <Bell className="h-4 w-4" aria-hidden />
              {sseDisconnected && (
                <span
                  className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full"
                  style={{ backgroundColor: 'var(--warning)' }}
                  aria-hidden
                />
              )}
            </span>
            <span className="flex-1 text-left">알림</span>
            {unreadCount > 0 && (
              <span
                className="flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white"
                style={{ background: 'var(--primary)' }}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        ) : (
          <button
            ref={bellRef}
            type="button"
            aria-label={`알림 ${unreadCount > 0 ? `(${unreadCount}개 미읽음)` : ''}${sseDisconnected ? ' (실시간 연결 끊김)' : ''}`}
            aria-haspopup="true"
            aria-expanded={open}
            title={sseDisconnected ? '실시간 알림 연결이 끊어졌습니다. 60초마다 갱신됩니다.' : undefined}
            onClick={handleToggle}
            className={cn(
              'relative flex items-center justify-center bg-bg-alt w-7 h-7 rounded-sm',
              'text-text-3 transition-colors',
              'hover:text-text',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            )}
          >
            <Bell className="h-3.5 w-3.5" aria-hidden />
            {sseDisconnected && (
              <span
                className="absolute -left-0.5 -top-0.5 h-2 w-2 rounded-full"
                style={{ backgroundColor: 'var(--warning)' }}
                aria-hidden
              />
            )}
            {unreadCount > 0 && (
              <span
                className="absolute -right-1 -top-1 flex items-center justify-center rounded-full bg-error text-white min-w-4 h-4 text-[9px] font-bold px-1"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        )}

        {/* 드롭다운 */}
        {open && (
          <div
            className="z-[60] w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-card border border-border bg-bg-card shadow-modal sm:max-w-80"
            style={panelStyle}
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
                  className="text-[10px] font-medium text-primary transition-colors hover:underline"
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
                          'mt-0.5 flex shrink-0 items-center justify-center rounded-md w-7 h-7',
                          notification.read
                            ? 'bg-bg-alt'
                            : 'bg-primary-soft2',
                        )}
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
                          className="mt-1.5 shrink-0 rounded-full bg-primary w-1.5 h-1.5"
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
        onDismiss={handleToastDismiss}
        onRead={handleToastRead}
      />
    </>
  );
}
