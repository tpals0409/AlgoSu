import { useState, useRef, useEffect } from 'react';
import { Bell, X, CheckCheck, MessageSquare, Cpu, Clock, Info } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export type NotificationType = 'review' | 'ai_done' | 'deadline' | 'system';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body?: string;
  timeAgo: string;
  read: boolean;
  link?: string;
}

const TYPE_META: Record<string, { Icon: React.ElementType; color: string }> = {
  review:   { Icon: MessageSquare, color: 'var(--primary)' },
  ai_done:  { Icon: Cpu,           color: 'var(--success)' },
  deadline: { Icon: Clock,         color: 'var(--warning)' },
  system:   { Icon: Info,          color: 'var(--info)' },
};

interface NotificationBellProps {
  /** sidebar: nav-item 스타일 전체너비 버튼 / header: 아이콘 버튼 */
  placement?: 'sidebar' | 'header';
}

export function NotificationBell({ placement = 'sidebar' }: NotificationBellProps) {
  const [open, setOpen]   = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const containerRef      = useRef<HTMLDivElement>(null);
  const router            = useRouter();

  const unread = items.filter((n) => !n.read).length;

  // 바깥 클릭 시 닫기
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  function markAllRead() {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setOpen(false);
    toast.success('모든 알림을 읽음 처리했습니다.');
  }

  function handleItem(n: AppNotification) {
    if (!n.read) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    }
    setOpen(false);
    if (n.link) {
      router.push(n.link);
      toast.info(n.title, { description: n.body, duration: 3000 });
    }
  }

  // 패널 위치: sidebar → 위쪽으로 열림(우측 정렬) / header → 아래쪽으로 열림(우측 정렬)
  const panelCls =
    placement === 'sidebar'
      ? 'absolute bottom-full right-0 mb-2'
      : 'absolute top-full right-0 mt-2';

  return (
    <div ref={containerRef} className="relative">
      {/* ── 트리거 버튼 ── */}
      {placement === 'sidebar' ? (
        // 사이드바: NavItem 스타일 전체너비 버튼
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-btn px-3 py-2 text-[13px] font-medium transition-all duration-150',
            open
              ? 'bg-primary-soft text-primary'
              : 'text-text-3 hover:bg-bg-alt hover:text-text-2',
          )}
        >
          <Bell className="h-4 w-4 shrink-0" aria-hidden />
          <span className="flex-1 text-left">알림</span>
          {unread > 0 && (
            <span
              className="flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white"
              style={{ background: 'var(--primary)' }}
            >
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      ) : (
        // 모바일 헤더: 아이콘 버튼
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="relative flex h-8 w-8 items-center justify-center rounded-btn transition-colors hover:bg-bg-alt"
          style={{ color: open ? 'var(--primary)' : 'var(--text-3)' }}
          aria-label="알림"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span
              className="absolute -right-0.5 -top-0.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full px-0.5 text-[9px] font-bold text-white"
              style={{ background: 'var(--primary)' }}
            >
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      )}

      {/* ── 알림 패널 ── */}
      {open && (
        <div
          className={cn(
            'z-[200] overflow-hidden rounded-card border',
            panelCls,
          )}
          style={{
            position: 'absolute',
            width: '300px',
            maxWidth: 'calc(100vw - 1rem)',
            background: 'var(--bg-card)',
            borderColor: 'var(--border)',
            boxShadow: 'var(--shadow-modal)',
          }}
        >
          {/* 헤더 */}
          <div
            className="flex items-center justify-between border-b px-4 py-2.5"
            style={{ borderColor: 'var(--border)' }}
          >
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>
                알림
              </span>
              {unread > 0 && (
                <span
                  className="flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white"
                  style={{ background: 'var(--primary)' }}
                >
                  {unread}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="flex items-center gap-1 rounded-btn px-2 py-1 text-[11px] transition-colors hover:bg-bg-alt"
                  style={{ color: 'var(--text-3)' }}
                >
                  <CheckCheck className="h-3 w-3" />
                  모두 읽음
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-btn p-1 transition-colors hover:bg-bg-alt"
                style={{ color: 'var(--text-3)' }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* 목록 */}
          <div className="max-h-[360px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
            {items.length === 0 ? (
              <p className="py-10 text-center text-[12px]" style={{ color: 'var(--text-3)' }}>
                알림이 없습니다.
              </p>
            ) : (
              items.map((n) => {
                const { Icon, color } = TYPE_META[n.type] ?? TYPE_META.system;
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => handleItem(n)}
                    className="flex w-full items-start gap-3 border-b px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-bg-alt"
                    style={{
                      borderColor: 'var(--border)',
                      background: n.read
                        ? 'transparent'
                        : 'color-mix(in srgb, var(--primary) 5%, transparent)',
                    }}
                  >
                    {/* 타입 아이콘 */}
                    <div
                      className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                      style={{ background: `color-mix(in srgb, ${color} 14%, transparent)` }}
                    >
                      <Icon className="h-3 w-3" style={{ color }} />
                    </div>

                    {/* 텍스트 */}
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-[12px] font-medium leading-snug"
                        style={{ color: n.read ? 'var(--text-2)' : 'var(--text)' }}
                      >
                        {n.title}
                      </p>
                      {n.body && (
                        <p
                          className="mt-0.5 line-clamp-2 text-[11px] leading-snug"
                          style={{ color: 'var(--text-3)' }}
                        >
                          {n.body}
                        </p>
                      )}
                      <p className="mt-1 text-[10px]" style={{ color: 'var(--text-3)' }}>
                        {n.timeAgo}
                      </p>
                    </div>

                    {/* 읽지 않음 도트 */}
                    {!n.read && (
                      <div
                        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ background: 'var(--primary)' }}
                      />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}