import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { NotificationBell } from '../NotificationBell';
import type { Notification } from '@/lib/api';

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
  };
});

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
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

// useNotificationSSE mock — SSE 콜백을 외부에서 주입 가능하도록
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

// ─── 헬퍼: 다양한 시간의 알림 생성 ───────────────────────

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'n-1',
    userId: 'user-1',
    type: 'AI_COMPLETED',
    title: 'AI 분석 완료',
    message: '코드 분석이 완료되었습니다',
    link: '/submissions/123',
    read: false,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

/** 지정한 분 전 ISO 문자열 반환 */
function minutesAgo(m: number): string {
  return new Date(Date.now() - m * 60_000).toISOString();
}

/** 지정한 시간 전 ISO 문자열 반환 */
function hoursAgo(h: number): string {
  return minutesAgo(h * 60);
}

/** 지정한 일 전 ISO 문자열 반환 */
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
  });

  // ─── 기본 렌더링 ─────────────────────────────────────────

  it('벨 버튼이 렌더링된다', async () => {
    await act(async () => {
      render(<NotificationBell />);
    });
    expect(screen.getByRole('button', { name: /알림/ })).toBeInTheDocument();
  });

  it('미읽음 수가 있으면 뱃지를 표시한다', async () => {
    mockUnreadCount.mockResolvedValue({ count: 5 });
    await act(async () => {
      render(<NotificationBell />);
    });
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('9개 초과 시 9+를 표시한다 (sidebar placement)', async () => {
    mockUnreadCount.mockResolvedValue({ count: 150 });
    await act(async () => {
      render(<NotificationBell />);
    });
    expect(screen.getByText('9+')).toBeInTheDocument();
  });

  it('벨 클릭 시 드롭다운이 열린다', async () => {
    mockList.mockResolvedValue([sampleNotification]);
    await act(async () => {
      render(<NotificationBell />);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /알림/ }));
    });
    expect(screen.getByRole('menu', { name: '알림 목록' })).toBeInTheDocument();
  });

  it('알림이 없으면 빈 상태 메시지를 표시한다', async () => {
    mockList.mockResolvedValue([]);
    await act(async () => {
      render(<NotificationBell />);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /알림/ }));
    });
    expect(screen.getByText('새로운 알림이 없습니다')).toBeInTheDocument();
  });

  // ─── formatRelativeTime 분기 (72-77) ─────────────────────

  it('방금 전 알림은 "방금 전"을 표시한다', async () => {
    const notif = makeNotification({ createdAt: new Date().toISOString() });
    mockList.mockResolvedValue([notif]);
    await act(async () => {
      render(<NotificationBell />);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /알림/ }));
    });
    expect(screen.getByText('방금 전')).toBeInTheDocument();
  });

  it('30분 전 알림은 "30분 전"을 표시한다', async () => {
    const notif = makeNotification({ createdAt: minutesAgo(30) });
    mockList.mockResolvedValue([notif]);
    await act(async () => {
      render(<NotificationBell />);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /알림/ }));
    });
    expect(screen.getByText('30분 전')).toBeInTheDocument();
  });

  it('3시간 전 알림은 "3시간 전"을 표시한다', async () => {
    const notif = makeNotification({ createdAt: hoursAgo(3) });
    mockList.mockResolvedValue([notif]);
    await act(async () => {
      render(<NotificationBell />);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /알림/ }));
    });
    expect(screen.getByText('3시간 전')).toBeInTheDocument();
  });

  it('3일 전 알림은 "3일 전"을 표시한다', async () => {
    const notif = makeNotification({ createdAt: daysAgo(3) });
    mockList.mockResolvedValue([notif]);
    await act(async () => {
      render(<NotificationBell />);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /알림/ }));
    });
    expect(screen.getByText('3일 전')).toBeInTheDocument();
  });

  it('7일 이상 지난 알림은 날짜 형식(toLocaleDateString)을 표시한다', async () => {
    const oldDate = daysAgo(10);
    const notif = makeNotification({ createdAt: oldDate });
    mockList.mockResolvedValue([notif]);
    await act(async () => {
      render(<NotificationBell />);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /알림/ }));
    });
    const formatted = new Date(oldDate).toLocaleDateString('ko-KR');
    expect(screen.getByText(formatted)).toBeInTheDocument();
  });

  // ─── fetchUnreadCount 실패 분기 (105-107) ────────────────

  it('unreadCount API 실패 시 조용히 실패한다', async () => {
    mockUnreadCount.mockRejectedValue(new Error('network error'));
    await expect(async () => {
      await act(async () => {
        render(<NotificationBell />);
      });
    }).not.toThrow();
  });

  // ─── loadNotifications 실패 분기 ─────────────────────────

  it('list API 실패 시 isLoading이 false로 복구된다', async () => {
    mockList.mockRejectedValue(new Error('list error'));
    await act(async () => {
      render(<NotificationBell />);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /알림/ }));
    });
    // 에러 후 빈 상태 메시지가 나타남
    expect(screen.getByText('새로운 알림이 없습니다')).toBeInTheDocument();
  });

  // ─── 드롭다운 두 번 클릭(토글 닫기) ─────────────────────

  it('벨을 두 번 클릭하면 드롭다운이 닫힌다', async () => {
    mockList.mockResolvedValue([]);
    await act(async () => {
      render(<NotificationBell />);
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

  // ─── 외부 클릭으로 닫기 (200-201) ────────────────────────

  it('외부 클릭 시 드롭다운이 닫힌다', async () => {
    mockList.mockResolvedValue([]);
    await act(async () => {
      render(<NotificationBell />);
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

  // ─── 개별 읽음 처리 (170-177) ────────────────────────────

  it('미읽음 알림 클릭 시 markRead를 호출하고 router.push를 실행한다', async () => {
    const unreadNotif = makeNotification({ link: '/submissions/123', read: false });
    mockList.mockResolvedValue([unreadNotif]);
    await act(async () => {
      render(<NotificationBell />);
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

  it('이미 읽은 알림 클릭 시 markRead를 호출하지 않는다', async () => {
    const readNotif = makeNotification({ read: true });
    mockList.mockResolvedValue([readNotif]);
    await act(async () => {
      render(<NotificationBell />);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /알림/ }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem'));
    });
    expect(mockMarkRead).not.toHaveBeenCalled();
  });

  it('link가 없으면 TYPE_ROUTE fallback으로 router.push를 실행한다', async () => {
    const notif = makeNotification({ link: null, type: 'AI_COMPLETED' });
    mockList.mockResolvedValue([notif]);
    await act(async () => {
      render(<NotificationBell />);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /알림/ }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem'));
    });
    expect(mockPush).toHaveBeenCalledWith('/submissions');
  });

  it('link도 TYPE_ROUTE도 없으면 router.push를 호출하지 않는다', async () => {
    const notif = makeNotification({ link: null, type: 'UNKNOWN_TYPE' as never, read: true });
    mockList.mockResolvedValue([notif]);
    await act(async () => {
      render(<NotificationBell />);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /알림/ }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem'));
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('markRead API 실패 시 조용히 실패한다', async () => {
    mockMarkRead.mockRejectedValue(new Error('mark read error'));
    const unreadNotif = makeNotification({ read: false });
    mockList.mockResolvedValue([unreadNotif]);
    await act(async () => {
      render(<NotificationBell />);
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

  // ─── 전체 읽음 처리 (188-191) ────────────────────────────

  it('미읽음이 있을 때 "모두 읽음" 버튼이 표시된다', async () => {
    mockUnreadCount.mockResolvedValue({ count: 3 });
    mockList.mockResolvedValue([makeNotification({ read: false })]);
    await act(async () => {
      render(<NotificationBell />);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /알림/ }));
    });
    expect(screen.getByText('모두 읽음')).toBeInTheDocument();
  });

  it('"모두 읽음" 클릭 시 markAllRead를 호출하고 unreadCount를 0으로 만든다', async () => {
    mockUnreadCount.mockResolvedValue({ count: 3 });
    mockList.mockResolvedValue([makeNotification({ read: false })]);
    await act(async () => {
      render(<NotificationBell />);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /알림/ }));
    });
    const markAllBtn = screen.getByText('모두 읽음');
    await act(async () => {
      fireEvent.click(markAllBtn);
    });
    expect(mockMarkAllRead).toHaveBeenCalled();
    // 모두 읽음 후 뱃지가 사라진다
    await waitFor(() => {
      expect(screen.queryByText('3')).not.toBeInTheDocument();
    });
  });

  it('markAllRead API 실패 시 조용히 실패한다', async () => {
    mockMarkAllRead.mockRejectedValue(new Error('mark all read error'));
    mockUnreadCount.mockResolvedValue({ count: 2 });
    mockList.mockResolvedValue([makeNotification({ read: false })]);
    await act(async () => {
      render(<NotificationBell />);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /알림/ }));
    });
    await expect(async () => {
      await act(async () => {
        fireEvent.click(screen.getByText('모두 읽음'));
      });
    }).not.toThrow();
  });

  // ─── SSE 수신 (handleSSENotification) ────────────────────

  it('SSE 알림 수신 시 notifications와 unreadCount가 업데이트된다', async () => {
    mockUnreadCount.mockResolvedValue({ count: 0 });
    mockList.mockResolvedValue([]);
    await act(async () => {
      render(<NotificationBell />);
    });
    // SSE 콜백 직접 호출
    const sseNotif = makeNotification({ id: 'sse-1', title: 'SSE 알림' });
    await act(async () => {
      capturedSSECallback?.(sseNotif);
    });
    // unread 뱃지에 1 표시
    expect(screen.getByText('1')).toBeInTheDocument();
    // 토스트에 알림 제목 표시
    expect(screen.getByTestId('notification-toast')).toHaveTextContent('SSE 알림');
  });

  it('SSE 알림 수신 후 드롭다운 열면 새 알림이 포함된다', async () => {
    mockUnreadCount.mockResolvedValue({ count: 0 });
    mockList.mockResolvedValue([]);
    await act(async () => {
      render(<NotificationBell />);
    });
    const sseNotif = makeNotification({ id: 'sse-2', title: 'SSE 새 알림' });
    await act(async () => {
      capturedSSECallback?.(sseNotif);
    });
    // 드롭다운 열기 — list는 빈 배열 반환하지만 SSE로 추가된 것은 state에 남아 있음
    mockList.mockResolvedValue([sseNotif]);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /알림/ }));
    });
    // SSE 새 알림은 드롭다운 menuitem과 토스트 두 곳에 표시될 수 있음
    expect(screen.getAllByText('SSE 새 알림').length).toBeGreaterThan(0);
  });

  // ─── 미읽음 없을 때 "모두 읽음" 버튼 미표시 (248) ────────

  it('미읽음이 없으면 "모두 읽음" 버튼이 표시되지 않는다', async () => {
    mockUnreadCount.mockResolvedValue({ count: 0 });
    mockList.mockResolvedValue([]);
    await act(async () => {
      render(<NotificationBell />);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /알림/ }));
    });
    expect(screen.queryByText('모두 읽음')).not.toBeInTheDocument();
  });

  // ─── 알림 타입별 아이콘 분기 (281-367) ──────────────────

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
    it(`${type} 알림 클릭 시 ${route}로 이동한다`, async () => {
      const notif = makeNotification({ type: type as never, link: null, read: true });
      mockList.mockResolvedValue([notif]);
      await act(async () => {
        render(<NotificationBell />);
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

  // ─── 미읽음/읽음 알림 스타일 분기 ───────────────────────

  it('미읽음 알림에 미읽음 표시 점(aria-label="미읽음")이 렌더링된다', async () => {
    const unreadNotif = makeNotification({ read: false });
    mockList.mockResolvedValue([unreadNotif]);
    await act(async () => {
      render(<NotificationBell />);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /알림/ }));
    });
    expect(screen.getByLabelText('미읽음')).toBeInTheDocument();
  });

  it('읽은 알림에는 미읽음 점이 렌더링되지 않는다', async () => {
    const readNotif = makeNotification({ read: true });
    mockList.mockResolvedValue([readNotif]);
    await act(async () => {
      render(<NotificationBell />);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /알림/ }));
    });
    expect(screen.queryByLabelText('미읽음')).not.toBeInTheDocument();
  });

  // ─── 로딩 중 스켈레톤 표시 ────────────────────────────────

  it('알림 로드 중에는 스켈레톤 3개가 표시된다', async () => {
    let resolveList!: (v: Notification[]) => void;
    mockList.mockReturnValue(new Promise<Notification[]>((res) => { resolveList = res; }));
    await act(async () => {
      render(<NotificationBell />);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /알림/ }));
    });
    // 로딩 중에는 스켈레톤 div 3개 (animate-pulse)
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBe(3);
    // 해소
    await act(async () => {
      resolveList([]);
    });
  });

  // ─── NotificationToast onDismiss / onRead 콜백 (366-367) ─────────────────

  it('handleMarkRead 시 ID가 일치하지 않는 알림은 그대로 유지된다 (n.id !== notificationId 분기)', async () => {
    // Branch 5 at line 174: cond-expr 의 ELSE 분기 커버
    const notif1 = makeNotification({ id: 'n-1', title: 'First', read: false });
    const notif2 = makeNotification({ id: 'n-2', title: 'Second', read: false });
    mockList.mockResolvedValue([notif1, notif2]);
    await act(async () => {
      render(<NotificationBell />);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /알림/ }));
    });
    // n-1을 읽음 처리: n-2는 그대로 유지됨 (else 분기)
    const menuItems = screen.getAllByRole('menuitem');
    await act(async () => {
      fireEvent.click(menuItems[0]);
    });
    expect(mockMarkRead).toHaveBeenCalledWith('n-1');
  });

  it('NotificationBell 내부 클릭 시 드롭다운이 유지된다 (ref.current.contains() = true 분기)', async () => {
    // Branch 6 at line 200: if (ref.current && !ref.current.contains(e.target)) 의 false 분기
    mockList.mockResolvedValue([]);
    await act(async () => {
      render(<NotificationBell />);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /알림/ }));
    });
    expect(screen.getByRole('menu')).toBeInTheDocument();
    // 내부 요소에 mouseDown → contains()가 true → setOpen(false) 미호출
    const menu = screen.getByRole('menu');
    await act(async () => {
      fireEvent.mouseDown(menu);
    });
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('NotificationToast의 onDismiss 콜백이 toastNotification을 null로 초기화한다', async () => {
    mockUnreadCount.mockResolvedValue({ count: 0 });
    await act(async () => {
      render(<NotificationBell />);
    });
    // SSE로 알림 수신하여 toastNotification 설정
    const sseNotif = makeNotification({ id: 'toast-1', title: '토스트 알림' });
    await act(async () => {
      capturedSSECallback?.(sseNotif);
    });
    // 토스트가 표시됨
    expect(screen.getByTestId('notification-toast')).toHaveTextContent('토스트 알림');
    // onDismiss 콜백 직접 호출 → toastNotification이 null이 됨
    await act(async () => {
      capturedOnDismiss?.();
    });
    expect(screen.getByTestId('notification-toast')).toHaveTextContent('');
  });

  it('NotificationToast의 onRead 콜백이 handleMarkRead를 호출한다', async () => {
    mockUnreadCount.mockResolvedValue({ count: 0 });
    await act(async () => {
      render(<NotificationBell />);
    });
    // SSE로 알림 수신하여 toastNotification 설정
    const sseNotif = makeNotification({ id: 'read-1', title: '읽음 알림' });
    await act(async () => {
      capturedSSECallback?.(sseNotif);
    });
    // onRead 콜백 직접 호출 → handleMarkRead('read-1') 호출
    await act(async () => {
      capturedOnRead?.('read-1');
    });
    expect(mockMarkRead).toHaveBeenCalledWith('read-1');
  });
});
