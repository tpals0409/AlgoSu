import { render, screen, act } from '@testing-library/react';
import { TimerBadge } from '../TimerBadge';

jest.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

describe('TimerBadge', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('마감된 경우 "마감"을 표시한다', () => {
    const past = new Date(Date.now() - 60000).toISOString();
    render(<TimerBadge deadline={past} />);
    expect(screen.getByText('마감')).toBeInTheDocument();
    expect(screen.getByLabelText('마감 종료')).toBeInTheDocument();
  });

  it('1시간 미만이면 분 단위를 표시한다 (critical)', () => {
    const deadline = new Date(Date.now() + 30 * 60000).toISOString();
    render(<TimerBadge deadline={deadline} />);
    expect(screen.getByText('30분')).toBeInTheDocument();
  });

  it('1~24시간이면 시간+분 형식을 표시한다 (warning)', () => {
    const deadline = new Date(Date.now() + 3 * 3600000 + 15 * 60000).toISOString();
    render(<TimerBadge deadline={deadline} />);
    expect(screen.getByText('3시간 15분')).toBeInTheDocument();
  });

  it('1일 이상이면 Nd 형식을 표시한다 (normal)', () => {
    const deadline = new Date(Date.now() + 3 * 86400000).toISOString();
    render(<TimerBadge deadline={deadline} />);
    expect(screen.getByText('3d')).toBeInTheDocument();
  });

  it('aria-label이 남은 시간을 포함한다', () => {
    const deadline = new Date(Date.now() + 30 * 60000).toISOString();
    render(<TimerBadge deadline={deadline} />);
    expect(screen.getByLabelText('마감까지 30분 남음')).toBeInTheDocument();
  });

  it('Date 객체를 deadline으로 받을 수 있다', () => {
    const deadline = new Date(Date.now() + 2 * 86400000);
    render(<TimerBadge deadline={deadline} />);
    expect(screen.getByText('2d')).toBeInTheDocument();
  });

  it('30초마다 상태를 업데이트한다', () => {
    const deadline = new Date(Date.now() + 31 * 60000).toISOString();
    render(<TimerBadge deadline={deadline} />);
    expect(screen.getByText('31분')).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(60000);
    });
    expect(screen.getByText('30분')).toBeInTheDocument();
  });

  it('className prop이 적용된다', () => {
    const deadline = new Date(Date.now() + 86400000).toISOString();
    const { container } = render(<TimerBadge deadline={deadline} className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });
});
