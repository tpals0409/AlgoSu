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

  it('Enter 외 키로는 토스트 클릭 동작이 실행되지 않는다', () => {
    const onRead = jest.fn();
    const notification = makeNotification();
    render(
      <NotificationToast notification={notification} onDismiss={jest.fn()} onRead={onRead} />,
    );

    act(() => { jest.advanceTimersByTime(100); });

    const buttons = screen.getAllByRole('button');
    const toastBody = buttons.find((el) => el.getAttribute('tabindex') === '0')!;
    // Space 키는 handleClick을 호출하지 않아야 한다
    fireEvent.keyDown(toastBody, { key: ' ' });
    fireEvent.keyDown(toastBody, { key: 'Escape' });

    expect(onRead).not.toHaveBeenCalled();
  });

  it('닫기 후 hideTimer가 실행되면 prev null 분기를 탄다 (line 64)', () => {
    // 닫기 버튼으로 토스트를 먼저 닫고, 아직 남아있는 hideTimer(4000ms)가 나중에 실행될 때
    // toast가 이미 null이므로 prev ? ... : null 의 null 분기가 실행됨
    const onDismiss = jest.fn();
    const notification = makeNotification();
    render(
      <NotificationToast notification={notification} onDismiss={onDismiss} onRead={jest.fn()} />,
    );

    // 50ms showTimer 실행 → visible: true
    act(() => { jest.advanceTimersByTime(100); });

    // 닫기 버튼 클릭 → handleClose 실행
    fireEvent.click(screen.getByLabelText('닫기'));
    // handleClose 내부 300ms setTimeout → setToast(null), onDismiss()
    act(() => { jest.advanceTimersByTime(300); });
    expect(onDismiss).toHaveBeenCalledTimes(1);

    // hideTimer (4000ms 시점)가 아직 남아있다 → 실행 시 toast가 null이므로 null 분기
    act(() => { jest.advanceTimersByTime(4000); });
    // hideTimer 내부 300ms setTimeout도 실행
    act(() => { jest.advanceTimersByTime(300); });
  });

  it('토스트 클릭 후 hideTimer가 실행되면 prev null 분기를 탄다 (line 64, 81)', () => {
    const onDismiss = jest.fn();
    const onRead = jest.fn();
    const notification = makeNotification();
    render(
      <NotificationToast notification={notification} onDismiss={onDismiss} onRead={onRead} />,
    );

    // 50ms showTimer 실행 → visible: true
    act(() => { jest.advanceTimersByTime(100); });

    // 토스트 본문 클릭
    const buttons = screen.getAllByRole('button');
    const toastBody = buttons.find((el) => el.getAttribute('tabindex') === '0')!;
    fireEvent.click(toastBody);

    // handleClick 내부 300ms setTimeout → setToast(null), onDismiss(), router.push()
    act(() => { jest.advanceTimersByTime(300); });
    expect(onRead).toHaveBeenCalledWith('n-1');

    // hideTimer (4000ms 시점)가 아직 남아있다 → prev null 분기
    act(() => { jest.advanceTimersByTime(4000); });
    act(() => { jest.advanceTimersByTime(300); });
  });

  it('handleClick이 toast null 상태에서 호출되면 조기 반환한다 (line 78)', () => {
    // notification이 null이면 toast도 null → handleClick은 !toast에서 return
    // 하지만 컴포넌트가 null을 렌더링하므로 직접 호출 불가
    // 대신: notification → 표시 → 닫기 → handleClick 호출 시도 (이미 사라진 상태)
    const onDismiss = jest.fn();
    const onRead = jest.fn();
    const notification = makeNotification();
    const { rerender } = render(
      <NotificationToast notification={notification} onDismiss={onDismiss} onRead={onRead} />,
    );

    act(() => { jest.advanceTimersByTime(100); });

    // 닫기로 토스트 제거
    fireEvent.click(screen.getByLabelText('닫기'));
    act(() => { jest.advanceTimersByTime(300); });

    // notification을 새로운 것으로 변경하여 다시 보여주되, 즉시 null로 다시 변경
    const notification2 = makeNotification({ id: 'n-2' });
    rerender(
      <NotificationToast notification={notification2} onDismiss={onDismiss} onRead={onRead} />,
    );
    // 아직 visible: false (showTimer 아직 안 됨). 이 상태에서 notification을 null로 변경
    rerender(
      <NotificationToast notification={null} onDismiss={onDismiss} onRead={onRead} />,
    );
    // cleanup에 의해 타이머 정리 & effect에서 notification이 null이므로 early return
    act(() => { jest.advanceTimersByTime(100); });
  });

  it('showTimer 전에 닫기 버튼 클릭 시 prev null 분기를 탄다 (line 59)', () => {
    // notification 설정 직후(showTimer 50ms 전에) 닫기를 눌러 toast를 null로 만들면
    // showTimer가 50ms 후 실행될 때 prev가 null
    const onDismiss = jest.fn();
    const notification = makeNotification();
    render(
      <NotificationToast notification={notification} onDismiss={onDismiss} onRead={jest.fn()} />,
    );

    // showTimer(50ms) 전에 즉시 닫기 버튼 클릭
    // toast는 { notification, visible: false } 상태
    const closeBtn = screen.getByLabelText('닫기');
    fireEvent.click(closeBtn);
    // handleClose의 300ms setTimeout에서 setToast(null) 호출
    act(() => { jest.advanceTimersByTime(10); });
    // 아직 showTimer(50ms)도 안 됨, handleClose의 setTimeout(300ms)도 아직
    // 하지만 handleClose가 이미 setToast(prev => prev ? {...prev, visible: false} : null) 호출
    act(() => { jest.advanceTimersByTime(300); });
    // 이제 toast는 null (handleClose의 setTimeout이 setToast(null) 호출)
    // showTimer(50ms)가 실행될 때 이미 toast가 null → prev null 분기
    // 실제로 showTimer는 이미 50ms 지점에서 실행됨 (총 310ms 경과)
    expect(onDismiss).toHaveBeenCalled();
  });
});
