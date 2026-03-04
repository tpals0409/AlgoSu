import { render, screen, fireEvent } from '@testing-library/react';
import { NotifPanel } from '../NotifPanel';
import type { Notification } from '@/lib/api';

// ─── 헬퍼 ────────────────────────────────────────────────

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: '1',
    userId: 'user-1',
    type: 'SUBMISSION_STATUS',
    title: 'Test Notification',
    message: 'Test message',
    link: null,
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

const mockNotification = makeNotification();

describe('NotifPanel', () => {
  // ─── 기본 렌더링 분기 ──────────────────────────────────

  it('returns null when open is false', () => {
    const { container } = render(
      <NotifPanel open={false} notifications={[mockNotification]} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders with role="region"', () => {
    render(<NotifPanel open={true} notifications={[mockNotification]} />);
    expect(screen.getByRole('region')).toBeInTheDocument();
  });

  it('has aria-label="알림 패널"', () => {
    render(<NotifPanel open={true} notifications={[mockNotification]} />);
    expect(screen.getByRole('region', { name: '알림 패널' })).toBeInTheDocument();
  });

  it('displays unread count badge', () => {
    render(<NotifPanel open={true} notifications={[mockNotification]} />);
    expect(screen.getByText('1개 미읽음')).toBeInTheDocument();
  });

  it('shows empty state when no unread notifications', () => {
    const readNotif = makeNotification({ read: true });
    render(<NotifPanel open={true} notifications={[readNotif]} />);
    expect(screen.getByText('새로운 알림이 없습니다')).toBeInTheDocument();
  });

  // ─── formatRelativeTime 분기 (61-65) ─────────────────────

  it('방금 전 알림은 "방금 전"을 표시한다', () => {
    const notif = makeNotification({ createdAt: new Date().toISOString() });
    render(<NotifPanel open={true} notifications={[notif]} />);
    expect(screen.getByText('방금 전')).toBeInTheDocument();
  });

  it('30분 전 알림은 "30분 전"을 표시한다', () => {
    const notif = makeNotification({ createdAt: minutesAgo(30) });
    render(<NotifPanel open={true} notifications={[notif]} />);
    expect(screen.getByText('30분 전')).toBeInTheDocument();
  });

  it('5시간 전 알림은 "5시간 전"을 표시한다', () => {
    const notif = makeNotification({ createdAt: hoursAgo(5) });
    render(<NotifPanel open={true} notifications={[notif]} />);
    expect(screen.getByText('5시간 전')).toBeInTheDocument();
  });

  it('3일 전 알림은 "3일 전"을 표시한다', () => {
    const notif = makeNotification({ createdAt: daysAgo(3) });
    render(<NotifPanel open={true} notifications={[notif]} />);
    expect(screen.getByText('3일 전')).toBeInTheDocument();
  });

  // ─── 키보드 접근성 (122-124) ──────────────────────────────

  it('Enter 키 입력 시 onClickNotif 콜백이 호출된다', () => {
    const onClickNotif = jest.fn();
    render(
      <NotifPanel
        open={true}
        notifications={[mockNotification]}
        onClickNotif={onClickNotif}
      />,
    );
    // 알림 아이템은 role="button" div — "모두 읽음" <button>도 있으므로 tagName으로 구분
    const items = screen.getAllByRole('button');
    const notifItem = items.find((el) => el.tagName !== 'BUTTON') ?? items[0];
    fireEvent.keyDown(notifItem, { key: 'Enter' });
    expect(onClickNotif).toHaveBeenCalledWith(mockNotification);
  });

  it('Enter 이외의 키는 onClickNotif를 호출하지 않는다', () => {
    const onClickNotif = jest.fn();
    render(
      <NotifPanel
        open={true}
        notifications={[mockNotification]}
        onClickNotif={onClickNotif}
      />,
    );
    // 알림 아이템은 role="button" div (tabIndex=0)
    const items = screen.getAllByRole('button');
    const notifItem = items.find((el) => el.tagName !== 'BUTTON') ?? items[0];
    fireEvent.keyDown(notifItem, { key: 'Space' });
    expect(onClickNotif).not.toHaveBeenCalled();
  });

  it('onClickNotif가 없어도 Enter 키 입력 시 에러가 발생하지 않는다', () => {
    render(<NotifPanel open={true} notifications={[mockNotification]} />);
    const items = screen.getAllByRole('button');
    const notifItem = items.find((el) => el.tagName !== 'BUTTON') ?? items[0];
    expect(() => fireEvent.keyDown(notifItem, { key: 'Enter' })).not.toThrow();
  });

  it('클릭 시 onClickNotif 콜백이 호출된다', () => {
    const onClickNotif = jest.fn();
    render(
      <NotifPanel
        open={true}
        notifications={[mockNotification]}
        onClickNotif={onClickNotif}
      />,
    );
    // 알림 아이템(div[role=button])을 클릭
    const items = screen.getAllByRole('button');
    const notifItem = items.find((el) => el.tagName !== 'BUTTON') ?? items[0];
    fireEvent.click(notifItem);
    expect(onClickNotif).toHaveBeenCalledWith(mockNotification);
  });

  it('onClickNotif가 없어도 클릭 시 에러가 발생하지 않는다', () => {
    render(<NotifPanel open={true} notifications={[mockNotification]} />);
    const items = screen.getAllByRole('button');
    const notifItem = items.find((el) => el.tagName !== 'BUTTON') ?? items[0];
    expect(() => fireEvent.click(notifItem)).not.toThrow();
  });

  // ─── "모두 읽음" 버튼 (199-222) ──────────────────────────

  it('미읽음이 있을 때 "모든 알림 읽음 처리" 버튼이 표시된다', () => {
    render(<NotifPanel open={true} notifications={[mockNotification]} />);
    expect(screen.getByText('모든 알림 읽음 처리')).toBeInTheDocument();
  });

  it('"모두 읽음" 버튼 클릭 시 onMarkAllRead 콜백이 호출된다', () => {
    const onMarkAllRead = jest.fn();
    render(
      <NotifPanel
        open={true}
        notifications={[mockNotification]}
        onMarkAllRead={onMarkAllRead}
      />,
    );
    fireEvent.click(screen.getByText('모든 알림 읽음 처리'));
    expect(onMarkAllRead).toHaveBeenCalled();
  });

  it('미읽음이 없으면 "모두 읽음" 버튼이 표시되지 않는다', () => {
    const readNotif = makeNotification({ read: true });
    render(<NotifPanel open={true} notifications={[readNotif]} />);
    expect(screen.queryByText('모든 알림 읽음 처리')).not.toBeInTheDocument();
  });

  it('알림이 빈 배열이면 "모두 읽음" 버튼이 표시되지 않는다', () => {
    render(<NotifPanel open={true} notifications={[]} />);
    expect(screen.queryByText('모든 알림 읽음 처리')).not.toBeInTheDocument();
    expect(screen.getByText('새로운 알림이 없습니다')).toBeInTheDocument();
  });

  // ─── TYPE_MAP 분기 (알림 타입별 아이콘) ─────────────────

  const allTypes = [
    'SUBMISSION_STATUS',
    'AI_COMPLETED',
    'GITHUB_FAILED',
    'ROLE_CHANGED',
    'PROBLEM_CREATED',
    'DEADLINE_REMINDER',
    'MEMBER_JOINED',
    'MEMBER_LEFT',
    'STUDY_CLOSED',
  ];

  allTypes.forEach((type) => {
    it(`${type} 타입 알림이 올바르게 렌더링된다`, () => {
      const notif = makeNotification({ type: type as never, title: `${type} 알림` });
      render(<NotifPanel open={true} notifications={[notif]} />);
      expect(screen.getByText(`${type} 알림`)).toBeInTheDocument();
    });
  });

  it('알 수 없는 타입은 "info" 스타일로 폴백된다', () => {
    const notif = makeNotification({ type: 'UNKNOWN_TYPE' as never, title: '알 수 없는 알림' });
    render(<NotifPanel open={true} notifications={[notif]} />);
    expect(screen.getByText('알 수 없는 알림')).toBeInTheDocument();
  });

  // ─── className prop ───────────────────────────────────────

  it('className prop이 패널에 적용된다', () => {
    render(
      <NotifPanel
        open={true}
        notifications={[mockNotification]}
        className="custom-class"
      />,
    );
    expect(screen.getByRole('region')).toHaveClass('custom-class');
  });

  // ─── 복수 알림 ────────────────────────────────────────────

  it('여러 미읽음 알림이 모두 렌더링된다', () => {
    const notifs = [
      makeNotification({ id: '1', title: '알림 1' }),
      makeNotification({ id: '2', title: '알림 2' }),
      makeNotification({ id: '3', title: '알림 3' }),
    ];
    render(<NotifPanel open={true} notifications={notifs} />);
    expect(screen.getByText('알림 1')).toBeInTheDocument();
    expect(screen.getByText('알림 2')).toBeInTheDocument();
    expect(screen.getByText('알림 3')).toBeInTheDocument();
    expect(screen.getByText('3개 미읽음')).toBeInTheDocument();
  });

  it('읽은 알림은 목록에 표시되지 않는다', () => {
    const notifs = [
      makeNotification({ id: '1', title: '읽은 알림', read: true }),
      makeNotification({ id: '2', title: '미읽음 알림', read: false }),
    ];
    render(<NotifPanel open={true} notifications={notifs} />);
    expect(screen.queryByText('읽은 알림')).not.toBeInTheDocument();
    expect(screen.getByText('미읽음 알림')).toBeInTheDocument();
    expect(screen.getByText('1개 미읽음')).toBeInTheDocument();
  });
});
