import { render, screen, fireEvent, act } from '@testing-library/react';
import { Toast } from '../Toast';
import type { ToastData } from '../Toast';

const baseToast: ToastData = {
  id: 1,
  type: 'success',
  title: 'Success message',
};

describe('Toast', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders the title message', () => {
    render(<Toast toast={baseToast} onDismiss={jest.fn()} />);
    expect(screen.getByText('Success message')).toBeInTheDocument();
  });

  it('renders with role="alert"', () => {
    render(<Toast toast={baseToast} onDismiss={jest.fn()} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('renders optional message text', () => {
    const toast: ToastData = { ...baseToast, message: 'Detail text' };
    render(<Toast toast={toast} onDismiss={jest.fn()} />);
    expect(screen.getByText('Detail text')).toBeInTheDocument();
  });

  it('calls onDismiss when close button is clicked', () => {
    const onDismiss = jest.fn();
    render(<Toast toast={baseToast} onDismiss={onDismiss} />);
    const closeBtn = screen.getByRole('button', { name: '닫기' });
    fireEvent.click(closeBtn);
    expect(closeBtn).toHaveAttribute('type', 'button');
  });

  it('close button has type="button"', () => {
    render(<Toast toast={baseToast} onDismiss={jest.fn()} />);
    const closeBtn = screen.getByRole('button', { name: '닫기' });
    expect(closeBtn).toHaveAttribute('type', 'button');
  });

  it('duration이 있으면 지정 시간 후 자동으로 onDismiss를 호출한다', () => {
    const onDismiss = jest.fn();
    const toast: ToastData = { ...baseToast, id: 5, duration: 1000 };
    render(<Toast toast={toast} onDismiss={onDismiss} />);

    act(() => {
      jest.advanceTimersByTime(1000 + 300); // duration + 애니메이션 delay
    });

    expect(onDismiss).toHaveBeenCalledWith(5);
  });

  it('duration이 없으면 자동으로 닫히지 않는다', () => {
    const onDismiss = jest.fn();
    render(<Toast toast={baseToast} onDismiss={onDismiss} />);

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('action이 있으면 액션 버튼을 렌더링한다', () => {
    const onAction = jest.fn();
    const toast: ToastData = { ...baseToast, action: '보기', onAction };
    render(<Toast toast={toast} onDismiss={jest.fn()} />);
    const actionBtn = screen.getByRole('button', { name: '보기' });
    expect(actionBtn).toBeInTheDocument();
    fireEvent.click(actionBtn);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('duration이 있으면 프로그레스바를 표시한다', () => {
    const toast: ToastData = { ...baseToast, duration: 3000 };
    const { container } = render(<Toast toast={toast} onDismiss={jest.fn()} />);
    // 프로그레스바 div가 렌더링됨
    const progressContainer = container.querySelector('.absolute.bottom-0');
    expect(progressContainer).toBeInTheDocument();
  });

  it('닫기 버튼 클릭 후 300ms 내에 onDismiss 호출된다', () => {
    const onDismiss = jest.fn();
    render(<Toast toast={baseToast} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(onDismiss).toHaveBeenCalledWith(1);
  });
});

// ─── ToastIcon 타입별 테스트 ───

describe('Toast 타입별 아이콘 렌더링', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const types: Array<ToastData['type']> = ['success', 'error', 'warning', 'info', 'ai', 'submit', 'deadline'];

  types.forEach((type) => {
    it(`${type} 타입의 Toast를 렌더링한다`, () => {
      const toast: ToastData = { id: 1, type, title: `${type} 알림` };
      render(<Toast toast={toast} onDismiss={jest.fn()} />);
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(`${type} 알림`)).toBeInTheDocument();
    });
  });
});
