import { render, screen, fireEvent, act } from '@testing-library/react';
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

jest.mock('@/hooks/useNotificationSSE', () => ({
  useNotificationSSE: jest.fn(),
}));

jest.mock('@/components/ui/NotificationToast', () => ({
  NotificationToast: () => <div data-testid="notification-toast" />,
}));

const sampleNotification: Notification = {
  id: 'n-1',
  userId: 'user-1',
  type: 'AI_COMPLETED',
  title: 'AI 분석 완료',
  message: '코드 분석이 완료되었습니다',
  link: '/submissions/123',
  read: false,
  createdAt: new Date().toISOString(),
};

describe('NotificationBell', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUnreadCount.mockResolvedValue({ count: 0 });
    mockList.mockResolvedValue([]);
    mockMarkRead.mockResolvedValue(undefined);
    mockMarkAllRead.mockResolvedValue(undefined);
  });

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

  it('99개 초과 시 99+를 표시한다', async () => {
    mockUnreadCount.mockResolvedValue({ count: 150 });
    await act(async () => {
      render(<NotificationBell />);
    });
    expect(screen.getByText('99+')).toBeInTheDocument();
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
});
