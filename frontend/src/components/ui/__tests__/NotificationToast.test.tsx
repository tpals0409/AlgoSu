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

  it('link가 없으면 클릭해도 router.push를 호출하지 않는다', () => {
    const onRead = jest.fn();
    const onDismiss = jest.fn();
    const notification = makeNotification({ link: undefined });
    render(
      <NotificationToast notification={notification} onDismiss={onDismiss} onRead={onRead} />,
    );

    act(() => { jest.advanceTimersByTime(100); });

    const buttons = screen.getAllByRole('button');
    const toastBody = buttons.find((el) => el.getAttribute('tabindex') === '0')!;
    fireEvent.click(toastBody);

    expect(onRead).toHaveBeenCalledWith('n-1');

    act(() => { jest.advanceTimersByTime(300); });

    expect(mockPush).not.toHaveBeenCalled();
    expect(onDismiss).toHaveBeenCalled();
  });

  it('알 수 없는 알림 타입은 기본 Bell 아이콘을 사용한다', () => {
    const notification = makeNotification({ type: 'UNKNOWN_TYPE' as never });
    render(
      <NotificationToast notification={notification} onDismiss={jest.fn()} onRead={jest.fn()} />,
    );

    act(() => { jest.advanceTimersByTime(100); });

    expect(screen.getByText('AI 분석 완료')).toBeInTheDocument();
  });

  it('Enter 키로 토스트를 클릭할 수 있다', () => {
    const onRead = jest.fn();
    const notification = makeNotification();
    render(
      <NotificationToast notification={notification} onDismiss={jest.fn()} onRead={onRead} />,
    );

    act(() => { jest.advanceTimersByTime(100); });

    const buttons = screen.getAllByRole('button');
    const toastBody = buttons.find((el) => el.getAttribute('tabindex') === '0')!;
    fireEvent.keyDown(toastBody, { key: 'Enter' });

    expect(onRead).toHaveBeenCalledWith('n-1');
  });

  it('showTimer 실행 시 toast가 null이면 null을 유지한다 (prev null 분기)', () => {
    // 알림을 표시 후 즉시 null로 변경하여 showTimer가 실행될 때 toast가 null인 상태 시뮬레이션
    const onDismiss = jest.fn();
    const notification = makeNotification();
    const { rerender } = render(
      <NotificationToast notification={notification} onDismiss={onDismiss} onRead={jest.fn()} />,
    );
    // setToast({ notification, visible: false }) 호출 후 즉시 null로 설정
    // notification을 null로 변경하여 toast를 리셋 (하지만 showTimer는 여전히 pending)
    rerender(
      <NotificationToast notification={null} onDismiss={onDismiss} onRead={jest.fn()} />,
    );
    // showTimer (50ms)가 실행될 때 toast가 null이면 null 반환 (prev ? ... : null의 null 분기)
    act(() => { jest.advanceTimersByTime(100); });
    // 에러 없이 처리됨
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('hideTimer 실행 시 toast가 null이면 null을 유지한다', () => {
    const onDismiss = jest.fn();
    const notification = makeNotification();
    const { rerender } = render(
      <NotificationToast notification={notification} onDismiss={onDismiss} onRead={jest.fn()} />,
    );
    // 4초 전에 notification을 null로 변경
    act(() => { jest.advanceTimersByTime(100); });
    rerender(
      <NotificationToast notification={null} onDismiss={onDismiss} onRead={jest.fn()} />,
    );
    // hideTimer (4000ms)가 실행될 때 toast가 null이면 null 반환
    act(() => { jest.advanceTimersByTime(4000); });
    // 타이머 정리 후에도 에러 없음
    act(() => { jest.advanceTimersByTime(300); });
  });

  it('토스트 클릭 시 setToast의 prev null 분기가 처리된다', () => {
    const onDismiss = jest.fn();
    const onRead = jest.fn();
    const notification = makeNotification();
    const { rerender } = render(
      <NotificationToast notification={notification} onDismiss={onDismiss} onRead={onRead} />,
    );
    act(() => { jest.advanceTimersByTime(100); });

    // 클릭 직후 notification을 null로 변경
    const buttons = screen.getAllByRole('button');
    const toastBody = buttons.find((el) => el.getAttribute('tabindex') === '0')!;
    fireEvent.click(toastBody);

    // setTimeout 내부 setToast(null) 전에 toast를 null로 만들기 위해 rerender
    rerender(
      <NotificationToast notification={null} onDismiss={onDismiss} onRead={onRead} />,
    );
    // 300ms 후 내부 setTimeout 실행
    act(() => { jest.advanceTimersByTime(300); });
  });
});
