/**
 * @file Notification bell (v2 design system)
 * @domain notification
 * @layer component
 * @related NotificationToast, notificationApi, NotifPanel
 *
 * SWR refreshInterval 60s polling for unread count.
 * Notification list fetched only when panel is open (conditional key).
 * SSE/mutation triggers mutate() for instant refresh.
 * Click navigates to notification.link.
 * Full coverage of 10 notification types + "mark all read".
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
import { useTranslations, useLocale } from 'next-intl';
import { cn } from '@/lib/utils';
import { isSafeInternalPath } from '@/lib/url';
import { notificationApi, type Notification } from '@/lib/api';
import { cacheKeys } from '@/lib/swr';
import { NotificationToast } from '@/components/ui/NotificationToast';
import { useNotificationSSE } from '@/hooks/useNotificationSSE';

// ─── CONSTANTS ───────────────────────────

const MAX_NOTIFICATIONS = 50;

/** Fallback route per notification type (when link is absent) */
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

/** Icon per notification type */
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

// ─── LOCALE MAPPING ─────────────────────

const LOCALE_DATE_MAP: Record<string, string> = {
  ko: 'ko-KR',
  en: 'en-US',
};

// ─── RENDER ──────────────────────────────

/**
 * Notification bell + dropdown panel + toast
 * @domain notification
 */
export function NotificationBell(props?: { placement?: 'sidebar' | 'header' }): ReactNode {
  const placement = props?.placement ?? 'sidebar';
  const router = useRouter();
  const t = useTranslations('layout');
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [toastNotification, setToastNotification] =
    useState<Notification | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);
  const displayedToastIds = useRef(new Set<string>());
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});

  // ─── HELPERS ──────────────────────────────

  /**
   * Relative time format
   * @domain common
   */
  const formatRelativeTime = (dateStr: string): string => {
    const now = Date.now();
    const diff = now - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return t('notificationBell.justNow');
    if (minutes < 60) return t('notificationBell.minutesAgo', { minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t('notificationBell.hoursAgo', { hours });
    const days = Math.floor(hours / 24);
    if (days < 7) return t('notificationBell.daysAgo', { days });
    return new Date(dateStr).toLocaleDateString(LOCALE_DATE_MAP[locale] ?? 'ko-KR');
  };

  // ─── SWR ───────────────────────────────

  const { mutate } = useSWRConfig();

  /**
   * Unread count — 60s refreshInterval (SSE fallback)
   * @domain notification
   */
  const { data: unreadData } = useSWR<{ count: number }>(
    cacheKeys.notifications.unreadCount(),
    { refreshInterval: 60_000 },
  );
  const unreadCount = unreadData?.count ?? 0;

  /**
   * Notification list — fetched only when panel is open (conditional key)
   * @domain notification
   */
  const { data: notificationsData, isLoading } = useSWR<Notification[]>(
    open ? cacheKeys.notifications.list() : null,
  );
  const notifications = notificationsData?.slice(0, MAX_NOTIFICATIONS) ?? [];

  // ─── HOOKS ─────────────────────────────

  /**
   * SSE real-time notification — on new notification: SWR cache refresh + toast (dedup)
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

  // Build accessible aria-label for bell button
  const bellAriaLabel = (() => {
    let label = t('notificationBell.label');
    if (unreadCount > 0) label += ` ${t('notificationBell.ariaLabelUnread', { count: unreadCount })}`;
    if (sseDisconnected) label += ` ${t('notificationBell.ariaLabelDisconnected')}`;
    return label;
  })();

  /**
   * Bell toggle
   * @domain notification
   */
  const handleToggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      if (next) {
        // Calculate panel position relative to bell button (fixed)
        if (bellRef.current) {
          const rect = bellRef.current.getBoundingClientRect();
          const isDesktop = window.innerWidth >= 768; // md breakpoint
          if (placement === 'sidebar') {
            setPanelStyle({
              position: 'fixed',
              bottom: window.innerHeight - rect.top + 8,
              ...(isDesktop
                ? { left: rect.left }                          // Desktop: sidebar left → open right
                : { right: window.innerWidth - rect.right }),  // Mobile: sidebar right → open left
            });
          } else {
            // Header: open below button, right-aligned
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
   * Mark individual notification read — API call then SWR cache refresh
   * @domain notification
   */
  const handleMarkRead = useCallback(
    async (notificationId: string) => {
      try {
        await notificationApi.markRead(notificationId);
        void mutate(cacheKeys.notifications.unreadCount());
        void mutate(cacheKeys.notifications.list());
      } catch {
        // Silent failure
      }
    },
    [mutate],
  );

  /**
   * Mark all notifications read — API call then SWR cache refresh
   * @domain notification
   */
  const handleMarkAllRead = useCallback(async () => {
    try {
      await notificationApi.markAllRead();
      void mutate(cacheKeys.notifications.unreadCount());
      void mutate(cacheKeys.notifications.list());
    } catch {
      // Silent failure
    }
  }, [mutate]);

  const handleToastDismiss = useCallback(() => setToastNotification(null), []);
  const handleToastRead = useCallback((id: string) => void handleMarkRead(id), [handleMarkRead]);

  // Close on outside click
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
        {/* Bell button */}
        {placement === 'sidebar' ? (
          <button
            ref={bellRef}
            type="button"
            onClick={handleToggle}
            aria-label={bellAriaLabel}
            aria-haspopup="true"
            aria-expanded={open}
            title={sseDisconnected ? t('notificationBell.sseDisconnectedTitle') : undefined}
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
            <span className="flex-1 text-left">{t('notificationBell.label')}</span>
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
            aria-label={bellAriaLabel}
            aria-haspopup="true"
            aria-expanded={open}
            title={sseDisconnected ? t('notificationBell.sseDisconnectedTitle') : undefined}
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

        {/* Dropdown */}
        {open && (
          <div
            className="z-[60] w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-card border border-border bg-bg-card shadow-modal sm:max-w-80"
            style={panelStyle}
            role="menu"
            aria-label={t('notificationBell.panelList')}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <span className="text-[12px] font-semibold text-text">{t('notificationBell.panelTitle')}</span>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => void handleMarkAllRead()}
                  className="text-[10px] font-medium text-primary transition-colors hover:underline"
                >
                  {t('notificationBell.markAllRead')}
                </button>
              )}
            </div>

            {/* Notification list */}
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
                    {t('notificationBell.empty')}
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
                        if (route && isSafeInternalPath(route)) {
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
                          aria-label={t('notificationBell.unread')}
                        />
                      )}
                    </button>
                  );
                })}
            </div>
          </div>
        )}
      </div>

      {/* Bottom toast notification */}
      <NotificationToast
        notification={toastNotification}
        onDismiss={handleToastDismiss}
        onRead={handleToastRead}
      />
    </>
  );
}
