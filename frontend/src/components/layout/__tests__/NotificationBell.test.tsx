import { screen, fireEvent, act, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { renderWithI18n } from '@/test-utils/i18n';
import { NotificationBell } from '../NotificationBell';
import { swrFetcher } from '@/lib/swr';
import type { Notification } from '@/lib/api';

// SWR fetcher mock — key-based response control
jest.mock('@/lib/swr', () => ({
  ...jest.requireActual('@/lib/swr'),
  swrFetcher: jest.fn(),
}));

const mockedSwrFetcher = jest.mocked(swrFetcher);

jest.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return {
    Bell: Icon,
    FileText: Icon,
    Brain: Icon,
    AlertTriangle: Icon,
    Users: Icon,
    BookOpen: Icon,
    Clock: Icon,
    UserPlus: Icon,
    UserMinus: Icon,
    Lock: Icon,
    CheckCircle: Icon,
  };
});

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useParams: () => ({ locale: 'ko' }),
}));

jest.mock('@/lib/utils', () => ({
  cn: (...args: string[]) => args.filter(Boolean).join(' '),
}));

const mockUnreadCount = jest.fn();
const mockList = jest.fn();
const mockMarkRead = jest.fn();
const mockMarkAllRead = jest.fn();

jest.mock('@/lib/api', () => ({
  notificationApi: {
    unreadCount: () => mockUnreadCount(),
    list: () => mockList(),
    markRead: (id: string) => mockMarkRead(id),
    markAllRead: () => mockMarkAllRead(),
  },
}));

// useNotificationSSE mock — allows injecting SSE callback externally
let capturedSSECallback: ((n: Notification) => void) | null = null;
jest.mock('@/hooks/useNotificationSSE', () => ({
  useNotificationSSE: jest.fn((_enabled: boolean, cb: (n: Notification) => void) => {
    capturedSSECallback = cb;
    return { sseDisconnected: false };
  }),
}));

let capturedOnDismiss: (() => void) | null = null;
let capturedOnRead: ((id: string) => void) | null = null;

jest.mock('@/components/ui/NotificationToast', () => ({
  NotificationToast: ({
    notification,
    onDismiss,
    onRead,
  }: {
    notification: Notification | null;
    onDismiss: () => void;
    onRead: (id: string) => void;
  }) => {
    capturedOnDismiss = onDismiss;
    capturedOnRead = onRead;
    return (
      <div data-testid="notification-toast">
        {notification ? notification.title : ''}
      </div>
    );
  },
}));

/**
 * SWR test wrapper — isolated cache, no retries
 * Injects mockedSwrFetcher as fetcher for key-based response control
 */
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig
    value={{
      provider: () => new Map(),
      dedupingInterval: 0,
      fetcher: mockedSwrFetcher,
      shouldRetryOnError: false,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }}
  >
    {children}
  </SWRConfig>
);

// ─── Helper: create notification with various times ───────────────

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'n-1',
    userId: 'user-1',
    type: 'AI_COMPLETED',
    title: 'AI analysis complete',
    message: 'Code analysis has been completed',
    link: '/submissions/123',
    read: false,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

/** ISO string for N minutes ago */
function minutesAgo(m: number): string {
  return new Date(Date.now() - m * 60_000).toISOString();
}

/** ISO string for N hours ago */
function hoursAgo(h: number): string {
  return minutesAgo(h * 60);
}

/** ISO string for N days ago */
function daysAgo(d: number): string {
  return hoursAgo(d * 24);
}

const sampleNotification = makeNotification();

describe('NotificationBell', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedSSECallback = null;
    capturedOnDismiss = null;
    capturedOnRead = null;
    mockUnreadCount.mockResolvedValue({ count: 0 });
    mockList.mockResolvedValue([]);
    mockMarkRead.mockResolvedValue(undefined);
    mockMarkAllRead.mockResolvedValue(undefined);
    // SWR fetcher: delegate to mockUnreadCount / mockList based on key
    mockedSwrFetcher.mockImplementation((key: string | readonly [string, ...unknown[]]) => {
      const path = Array.isArray(key) ? key[0] : key;
      if (path === '/api/notifications/unread-count') return mockUnreadCount();
      if (path === '/api/notifications') return mockList();
      return Promise.resolve(null);
    });
  });

  // ─── Basic rendering ─────────────────────────────────────────

  it('bell button is rendered', async () => {
    await act(async () => {
      renderWithI18n(<NotificationBell />, { wrapper });
    });
    expect(screen.getByRole('button', { name: /알림/ })).toBeInTheDocument();
  });

  it('shows badge when there are unread notifications', async () => {
    mockUnreadCount.mockResolvedValue({ count: 5 });
    await act(async () => {
      renderWithI18n(<NotificationBell />, { wrapper });
    });
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('shows 9+ when count exceeds 9 (sidebar placement)', async () => {
    mockUnreadCount.mockResolvedValue({ count: 150 });
    await act(async () => {
      renderWithI18n(<NotificationBell />, { wrapper });
    });
    expect(screen.getByText('9+')).toBeInTheDocument();
  });

  it('opens dropdown on bell click', async () => {
    mockList.mockResolvedValue([sampleNotification]);
    await act(async () => {
      renderWithI18n(<NotificationBell />, { wrapper });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /알림/ }));
    });
    expect(screen.getByRole('menu', { name: /알림 목록/ })).toBeInTheDocument();
  });

  it('shows empty state when no notifications', async () => {
    mockList.mockResolvedValue([]);
    await act(async () => {
      renderWithI18n(<NotificationBell />, { wrapper });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /알림/ }));
    });
    expect(screen.getByText(/새로운 알림이 없습니다/)).toBeInTheDocument();
  });

  // ─── formatRelativeTime branches ─────────────────────

  it('shows "just now" for recent notifications', async () => {
    const notif = makeNotification({ createdAt: new Date().toISOString() });
    mockList.mockResolvedValue([notif]);
    await act(async () => {
      renderWithI18n(<NotificationBell />, { wrapper });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /알림/ }));
    });
    expect(screen.getByText(/방금 전/)).toBeInTheDocument();
  });

  it('shows "30 minutes ago" for 30-minute-old notifications', async () => {
    const notif = makeNotification({ createdAt: minutesAgo(30) });
    mockList.mockResolvedValue([notif]);
    await act(async () => {
      renderWithI18n(<NotificationBell />, { wrapper });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /알림/ }));
    });
    expect(screen.getByText(/30분 전/)).toBeInTheDocument();
  });

  it('shows "3 hours ago" for 3-hour-old notifications', async () => {
    const notif = makeNotification({ createdAt: hoursAgo(3) });
    mockList.mockResolvedValue([notif]);
    await act(async () => {
      renderWithI18n(<NotificationBell />, { wrapper });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /알림/ }));
    });
    expect(screen.getByText(/3시간 전/)).toBeInTheDocument();
  });

  it('shows "3 days ago" for 3-day-old notifications', async () => {
    const notif = makeNotification({ createdAt: daysAgo(3) });
    mockList.mockResolvedValue([notif]);
    await act(async () => {
      renderWithI18n(<NotificationBell />, { wrapper });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /알림/ }));
    });
    expect(screen.getByText(/3일 전/)).toBeInTheDocument();
  });

  it('shows date format for notifications older than 7 days', async () => {
    const oldDate = daysAgo(10);
    const notif = makeNotification({ createdAt: oldDate });
    mockList.mockResolvedValue([notif]);
    await act(async () => {
      renderWithI18n(<NotificationBell />, { wrapper });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /알림/ }));
    });
    const formatted = new Date(oldDate).toLocaleDateString('ko-KR');
    expect(screen.getByText(formatted)).toBeInTheDocument();
  });

  // ─── fetchUnreadCount failure branch ────────────────

  it('silently handles unreadCount API failure', async () => {
    mockUnreadCount.mockRejectedValue(new Error('network error'));
    await expect(async () => {
      await act(async () => {
        renderWithI18n(<NotificationBell />, { wrapper });
      });
    }).not.toThrow();
  });

  // ─── loadNotifications failure branch ─────────────────────

  it('recovers isLoading to false after list API failure', async () => {
    mockList.mockRejectedValue(new Error('list error'));
    await act(async () => {
      renderWithI18n(<NotificationBell />, { wrapper });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /알림/ }));
    });
    expect(screen.getByText(/새로운 알림이 없습니다/)).toBeInTheDocument();
  });

  // ─── Double-click toggle close ─────────────────────

  it('closes dropdown on double-click', async () => {
    mockList.mockResolvedValue([]);
    await act(async () => {
      renderWithI18n(<NotificationBell />, { wrapper });
    });
    const bellBtn = screen.getByRole('button', { name: /알림/ });
    await act(async () => {
      fireEvent.click(bellBtn);
    });
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(bellBtn);
    });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  // ─── Outside click closes dropdown ────────────────────────

  it('closes dropdown on outside click', async () => {
    mockList.mockResolvedValue([]);
    await act(async () => {
      renderWithI18n(<NotificationBell />, { wrapper });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /알림/ }));
    });
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await act(async () => {
      fireEvent.mouseDown(document.body);
    });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  // ─── Individual read handling ────────────────────────────

  it('calls markRead and router.push on unread notification click', async () => {
    const unreadNotif = makeNotification({ link: '/submissions/123', read: false });
    mockList.mockResolvedValue([unreadNotif]);
    await act(async () => {
      renderWithI18n(<NotificationBell />, { wrapper });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /알림/ }));
    });
    const menuItem = screen.getByRole('menuitem');
    await act(async () => {
      fireEvent.click(menuItem);
    });
    expect(mockMarkRead).toHaveBeenCalledWith('n-1');
    expect(mockPush).toHaveBeenCalledWith('/submissions/123');
  });

  it('does not call markRead on already-read notification click', async () => {
    const readNotif = makeNotification({ read: true });
    mockList.mockResolvedValue([readNotif]);
    await act(async () => {
      renderWithI18n(<NotificationBell />, { wrapper });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /알림/ }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem'));
    });
    expect(mockMarkRead).not.toHaveBeenCalled();
  });

  it('uses TYPE_ROUTE fallback when link is absent', async () => {
    const notif = makeNotification({ link: null, type: 'AI_COMPLETED' });
    mockList.mockResolvedValue([notif]);
    await act(async () => {
      renderWithI18n(<NotificationBell />, { wrapper });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /알림/ }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem'));
    });
    expect(mockPush).toHaveBeenCalledWith('/submissions');
  });

  it('does not call router.push when neither link nor TYPE_ROUTE exist', async () => {
    const notif = makeNotification({ link: null, type: 'UNKNOWN_TYPE' as never, read: true });
    mockList.mockResolvedValue([notif]);
    await act(async () => {
      renderWithI18n(<NotificationBell />, { wrapper });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /알림/ }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem'));
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('silently handles markRead API failure', async () => {
    mockMarkRead.mockRejectedValue(new Error('mark read error'));
    const unreadNotif = makeNotification({ read: false });
    mockList.mockResolvedValue([unreadNotif]);
    await act(async () => {
      renderWithI18n(<NotificationBell />, { wrapper });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /알림/ }));
    });
    await expect(async () => {
      await act(async () => {
        fireEvent.click(screen.getByRole('menuitem'));
      });
    }).not.toThrow();
  });

  // ─── Mark all read handling ────────────────────────────

  it('shows "mark all read" button when there are unread notifications', async () => {
    mockUnreadCount.mockResolvedValue({ count: 3 });
    mockList.mockResolvedValue([makeNotification({ read: false })]);
    await act(async () => {
      renderWithI18n(<NotificationBell />, { wrapper });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /알림/ }));
    });
    expect(screen.getByText(/모두 읽음/)).toBeInTheDocument();
  });

  it('calls markAllRead and clears unread count', async () => {
    mockUnreadCount.mockResolvedValue({ count: 3 });
    mockList.mockResolvedValue([makeNotification({ read: false })]);
    mockMarkAllRead.mockImplementation(async () => {
      mockUnreadCount.mockResolvedValue({ count: 0 });
    });
    await act(async () => {
      renderWithI18n(<NotificationBell />, { wrapper });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /알림/ }));
    });
    const markAllBtn = screen.getByText(/모두 읽음/);
    await act(async () => {
      fireEvent.click(markAllBtn);
    });
    expect(mockMarkAllRead).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByText('3')).not.toBeInTheDocument();
    });
  });

  it('silently handles markAllRead API failure', async () => {
    mockMarkAllRead.mockRejectedValue(new Error('mark all read error'));
    mockUnreadCount.mockResolvedValue({ count: 2 });
    mockList.mockResolvedValue([makeNotification({ read: false })]);
    await act(async () => {
      renderWithI18n(<NotificationBell />, { wrapper });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /알림/ }));
    });
    await expect(async () => {
      await act(async () => {
        fireEvent.click(screen.getByText(/모두 읽음/));
      });
    }).not.toThrow();
  });

  // ─── SSE handling (handleSSENotification) ────────────────────

  it('updates notifications and unreadCount on SSE notification', async () => {
    mockUnreadCount.mockResolvedValue({ count: 0 });
    mockList.mockResolvedValue([]);
    await act(async () => {
      renderWithI18n(<NotificationBell />, { wrapper });
    });
    mockUnreadCount.mockResolvedValue({ count: 1 });
    const sseNotif = makeNotification({ id: 'sse-1', title: 'SSE Notification' });
    await act(async () => {
      capturedSSECallback?.(sseNotif);
    });
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByTestId('notification-toast')).toHaveTextContent('SSE Notification');
  });

  it('shows new notification in dropdown after SSE receive', async () => {
    mockUnreadCount.mockResolvedValue({ count: 0 });
    mockList.mockResolvedValue([]);
    await act(async () => {
      renderWithI18n(<NotificationBell />, { wrapper });
    });
    const sseNotif = makeNotification({ id: 'sse-2', title: 'SSE New' });
    await act(async () => {
      capturedSSECallback?.(sseNotif);
    });
    mockList.mockResolvedValue([sseNotif]);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /알림/ }));
    });
    expect(screen.getAllByText('SSE New').length).toBeGreaterThan(0);
  });

  // ─── No unread: "mark all read" button not shown ────────

  it('does not show "mark all read" button when no unread', async () => {
    mockUnreadCount.mockResolvedValue({ count: 0 });
    mockList.mockResolvedValue([]);
    await act(async () => {
      renderWithI18n(<NotificationBell />, { wrapper });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /알림/ }));
    });
    expect(screen.queryByText(/모두 읽음/)).not.toBeInTheDocument();
  });

  // ─── Notification type route mapping ──────────────────

  const typeRouteMap: Array<{ type: string; route: string }> = [
    { type: 'SUBMISSION_STATUS', route: '/submissions' },
    { type: 'AI_COMPLETED', route: '/submissions' },
    { type: 'GITHUB_FAILED', route: '/submissions' },
    { type: 'ROLE_CHANGED', route: '/studies' },
    { type: 'PROBLEM_CREATED', route: '/problems' },
    { type: 'DEADLINE_REMINDER', route: '/problems' },
    { type: 'MEMBER_JOINED', route: '/studies' },
    { type: 'MEMBER_LEFT', route: '/studies' },
    { type: 'STUDY_CLOSED', route: '/studies' },
  ];

  typeRouteMap.forEach(({ type, route }) => {
    it(`${type} notification click navigates to ${route}`, async () => {
      const notif = makeNotification({ type: type as never, link: null, read: true });
      mockList.mockResolvedValue([notif]);
      await act(async () => {
        renderWithI18n(<NotificationBell />, { wrapper });
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /알림/ }));
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('menuitem'));
      });
      expect(mockPush).toHaveBeenCalledWith(route);
      mockPush.mockClear();
    });
  });

  // ─── Unread/read notification style branches ───────────────────────

  it('renders unread dot (aria-label) for unread notifications', async () => {
    const unreadNotif = makeNotification({ read: false });
    mockList.mockResolvedValue([unreadNotif]);
    await act(async () => {
      renderWithI18n(<NotificationBell />, { wrapper });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /알림/ }));
    });
    expect(screen.getByLabelText(/미읽음/)).toBeInTheDocument();
  });

  it('does not render unread dot for read notifications', async () => {
    const readNotif = makeNotification({ read: true });
    mockList.mockResolvedValue([readNotif]);
    await act(async () => {
      renderWithI18n(<NotificationBell />, { wrapper });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /알림/ }));
    });
    expect(screen.queryByLabelText(/미읽음/)).not.toBeInTheDocument();
  });

  // ─── Loading skeleton ────────────────────────────────

  it('shows 3 skeleton divs while loading', async () => {
    let resolveList!: (v: Notification[]) => void;
    mockList.mockReturnValue(new Promise<Notification[]>((res) => { resolveList = res; }));
    await act(async () => {
      renderWithI18n(<NotificationBell />, { wrapper });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /알림/ }));
    });
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBe(3);
    await act(async () => {
      resolveList([]);
    });
  });

  // ─── NotificationToast onDismiss / onRead callbacks ─────────────────

  it('handleMarkRead keeps non-matching notifications (n.id !== notificationId branch)', async () => {
    const notif1 = makeNotification({ id: 'n-1', title: 'First', read: false });
    const notif2 = makeNotification({ id: 'n-2', title: 'Second', read: false });
    mockList.mockResolvedValue([notif1, notif2]);
    await act(async () => {
      renderWithI18n(<NotificationBell />, { wrapper });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /알림/ }));
    });
    const menuItems = screen.getAllByRole('menuitem');
    await act(async () => {
      fireEvent.click(menuItems[0]);
    });
    expect(mockMarkRead).toHaveBeenCalledWith('n-1');
  });

  it('clicking inside keeps dropdown open (ref.current.contains() = true branch)', async () => {
    mockList.mockResolvedValue([]);
    await act(async () => {
      renderWithI18n(<NotificationBell />, { wrapper });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /알림/ }));
    });
    expect(screen.getByRole('menu')).toBeInTheDocument();
    const menu = screen.getByRole('menu');
    await act(async () => {
      fireEvent.mouseDown(menu);
    });
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('NotificationToast onDismiss clears toastNotification to null', async () => {
    mockUnreadCount.mockResolvedValue({ count: 0 });
    await act(async () => {
      renderWithI18n(<NotificationBell />, { wrapper });
    });
    const sseNotif = makeNotification({ id: 'toast-1', title: 'Toast Notification' });
    await act(async () => {
      capturedSSECallback?.(sseNotif);
    });
    expect(screen.getByTestId('notification-toast')).toHaveTextContent('Toast Notification');
    await act(async () => {
      capturedOnDismiss?.();
    });
    expect(screen.getByTestId('notification-toast')).toHaveTextContent('');
  });

  it('NotificationToast onRead calls handleMarkRead', async () => {
    mockUnreadCount.mockResolvedValue({ count: 0 });
    await act(async () => {
      renderWithI18n(<NotificationBell />, { wrapper });
    });
    const sseNotif = makeNotification({ id: 'read-1', title: 'Read Notification' });
    await act(async () => {
      capturedSSECallback?.(sseNotif);
    });
    await act(async () => {
      capturedOnRead?.('read-1');
    });
    expect(mockMarkRead).toHaveBeenCalledWith('read-1');
  });
});
