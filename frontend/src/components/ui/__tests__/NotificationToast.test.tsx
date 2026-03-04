import { render, screen, fireEvent, act } from '@testing-library/react';
import { NotificationToast } from '../NotificationToast';
import type { Notification } from '@/lib/api';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return {
    Bell: Icon,
    FileText: Icon,
    Brain: Icon,
    AlertTriangle: Icon,
    Users: Icon,
    BookOpen: Icon,
    X: Icon,
  };
});

jest.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

const makeNotification = (overrides: Partial<Notification> = {}): Notification => ({
  id: 'n-1',
  userId: 'u-1',
  type: 'AI_COMPLETED',
  title: 'AI 분석 완료',
  message: '코드 분석이 완료되었습니다.',
  link: '/submissions/s-1/analysis',
  read: false,
  createdAt: new Date().toISOString(),
  ...overrides,
});

describe('NotificationToast', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockPush.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('notification이 null이면 아무것도 렌더링하지 않는다', () => {
    const { container } = render(
      <NotificationToast notification={null} onDismiss={jest.fn()} onRead={jest.fn()} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('notification이 있으면 제목과 메시지를 표시한다', () => {
    const notification = makeNotification();
    render(
      <NotificationToast notification={notification} onDismiss={jest.fn()} onRead={jest.fn()} />,
    );

    act(() => { jest.advanceTimersByTime(100); });

    expect(screen.getByText('AI 분석 완료')).toBeInTheDocument();
    expect(screen.getByText('코드 분석이 완료되었습니다.')).toBeInTheDocument();
  });

  it('닫기 버튼이 존재한다', () => {
    const notification = makeNotification();
    render(
      <NotificationToast notification={notification} onDismiss={jest.fn()} onRead={jest.fn()} />,
    );

    act(() => { jest.advanceTimersByTime(100); });

    expect(screen.getByLabelText('닫기')).toBeInTheDocument();
  });

  it('닫기 버튼 클릭 시 onDismiss를 호출한다', () => {
    const onDismiss = jest.fn();
    const notification = makeNotification();
    render(
      <NotificationToast notification={notification} onDismiss={onDismiss} onRead={jest.fn()} />,
    );

    act(() => { jest.advanceTimersByTime(100); });

    fireEvent.click(screen.getByLabelText('닫기'));

    act(() => { jest.advanceTimersByTime(300); });

    expect(onDismiss).toHaveBeenCalled();
  });

  it('토스트 클릭 시 onRead를 호출하고 링크로 이동한다', () => {
    const onRead = jest.fn();
    const onDismiss = jest.fn();
    const notification = makeNotification();
    render(
      <NotificationToast notification={notification} onDismiss={onDismiss} onRead={onRead} />,
    );

    act(() => { jest.advanceTimersByTime(100); });

    const buttons = screen.getAllByRole('button');
    const toastBody = buttons.find((el) => el.getAttribute('tabindex') === '0')!;
    fireEvent.click(toastBody);

    expect(onRead).toHaveBeenCalledWith('n-1');

    act(() => { jest.advanceTimersByTime(300); });

    expect(mockPush).toHaveBeenCalledWith('/submissions/s-1/analysis');
  });

  it('4초 후 자동으로 사라진다', () => {
    const onDismiss = jest.fn();
    const notification = makeNotification();
    render(
      <NotificationToast notification={notification} onDismiss={onDismiss} onRead={jest.fn()} />,
    );

    act(() => { jest.advanceTimersByTime(4300); });

    expect(onDismiss).toHaveBeenCalled();
  });
});
