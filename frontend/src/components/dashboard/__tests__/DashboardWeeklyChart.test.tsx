import { screen, fireEvent } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/i18n';
import DashboardWeeklyChart from '../DashboardWeeklyChart';

jest.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return { BookOpen: Icon };
});

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

jest.mock('@/components/ui/Card', () => ({
  Card: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="card" {...props}>{children}</div>
  ),
  CardHeader: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="card-header" {...props}>{children}</div>
  ),
  CardTitle: ({ children }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3>{children}</h3>
  ),
  CardContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="card-content" {...props}>{children}</div>
  ),
}));

describe('DashboardWeeklyChart', () => {
  const defaultProps = {
    filteredByWeek: [] as { week: string; count: number }[],
    weekViewLabel: '전체',
    problemCountByWeek: new Map<string, number>(),
    members: [{ user_id: 'u-1' }],
    weekViewUserId: null as string | null,
    mounted: true,
    onCycleView: jest.fn(),
    fadeStyle: {},
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('제목 "주차별 제출 현황"을 렌더링한다', () => {
    renderWithI18n(<DashboardWeeklyChart {...defaultProps} />);
    expect(screen.getByText('주차별 제출 현황')).toBeInTheDocument();
  });

  it('weekViewLabel을 표시한다', () => {
    renderWithI18n(<DashboardWeeklyChart {...defaultProps} weekViewLabel="나의 제출" />);
    expect(screen.getByText('나의 제출')).toBeInTheDocument();
  });

  it('데이터가 없으면 빈 상태 메시지를 표시한다', () => {
    renderWithI18n(<DashboardWeeklyChart {...defaultProps} />);
    expect(screen.getByText('제출 기록이 없습니다.')).toBeInTheDocument();
  });

  it('주차 데이터를 바 차트로 렌더링한다', () => {
    const props = {
      ...defaultProps,
      filteredByWeek: [
        { week: '1월1주차', count: 3 },
        { week: '1월2주차', count: 5 },
      ],
      problemCountByWeek: new Map([
        ['1월1주차', 5],
        ['1월2주차', 5],
      ]),
    };
    renderWithI18n(<DashboardWeeklyChart {...props} />);
    expect(screen.getByText('1월1주차')).toBeInTheDocument();
    expect(screen.getByText('1월2주차')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('카드 클릭 시 onCycleView가 호출된다', () => {
    renderWithI18n(<DashboardWeeklyChart {...defaultProps} />);
    fireEvent.click(screen.getByTestId('card'));
    expect(defaultProps.onCycleView).toHaveBeenCalledTimes(1);
  });

  it('5주 초과 시 "전체 N주 보기" 링크를 표시한다', () => {
    const weeks = Array.from({ length: 7 }, (_, i) => ({
      week: `${i + 1}주차`,
      count: i + 1,
    }));
    const pcMap = new Map(weeks.map((w) => [w.week, 10]));
    renderWithI18n(
      <DashboardWeeklyChart
        {...defaultProps}
        filteredByWeek={weeks}
        problemCountByWeek={pcMap}
      />,
    );
    expect(screen.getByText('전체 7주 보기 →')).toBeInTheDocument();
  });

  it('5주 이하이면 "전체 N주 보기" 링크가 없다', () => {
    const weeks = [
      { week: '1월1주차', count: 3 },
      { week: '1월2주차', count: 5 },
    ];
    renderWithI18n(
      <DashboardWeeklyChart
        {...defaultProps}
        filteredByWeek={weeks}
        problemCountByWeek={new Map([['1월1주차', 5], ['1월2주차', 5]])}
      />,
    );
    expect(screen.queryByText(/전체.*주 보기/)).not.toBeInTheDocument();
  });

  it('weekViewUserId가 null이 아니면 개인별 max를 사용한다', () => {
    const weeks = [{ week: '1월1주차', count: 3 }];
    const pcMap = new Map([['1월1주차', 5]]);
    renderWithI18n(
      <DashboardWeeklyChart
        {...defaultProps}
        filteredByWeek={weeks}
        problemCountByWeek={pcMap}
        weekViewUserId="u-1"
        members={[{ user_id: 'u-1' }, { user_id: 'u-2' }]}
      />,
    );
    // weekViewUserId !== null → total = pc (개인용), 렌더링 확인
    expect(screen.getByText('1월1주차')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('problemCountByWeek에 없는 주차는 max=0으로 바 너비 0%이다', () => {
    const weeks = [{ week: '없는주차', count: 2 }];
    renderWithI18n(
      <DashboardWeeklyChart
        {...defaultProps}
        filteredByWeek={weeks}
        problemCountByWeek={new Map()}
      />,
    );
    expect(screen.getByText('없는주차')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('mounted=false이면 바 너비가 0%이다', () => {
    const weeks = [{ week: '1월1주차', count: 3 }];
    const pcMap = new Map([['1월1주차', 5]]);
    renderWithI18n(
      <DashboardWeeklyChart
        {...defaultProps}
        filteredByWeek={weeks}
        problemCountByWeek={pcMap}
        mounted={false}
      />,
    );
    expect(screen.getByText('1월1주차')).toBeInTheDocument();
  });

  it('Enter 키를 누르면 onCycleView가 호출된다 (line 88)', () => {
    const onCycleView = jest.fn();
    renderWithI18n(<DashboardWeeklyChart {...defaultProps} onCycleView={onCycleView} />);
    fireEvent.keyDown(screen.getByTestId('card'), { key: 'Enter' });
    expect(onCycleView).toHaveBeenCalledTimes(1);
  });

  it('Space 키를 누르면 onCycleView가 호출된다 (line 88)', () => {
    const onCycleView = jest.fn();
    renderWithI18n(<DashboardWeeklyChart {...defaultProps} onCycleView={onCycleView} />);
    fireEvent.keyDown(screen.getByTestId('card'), { key: ' ' });
    expect(onCycleView).toHaveBeenCalledTimes(1);
  });

  it('Enter/Space 외 키로는 onCycleView가 호출되지 않는다', () => {
    const onCycleView = jest.fn();
    renderWithI18n(<DashboardWeeklyChart {...defaultProps} onCycleView={onCycleView} />);
    fireEvent.keyDown(screen.getByTestId('card'), { key: 'Escape' });
    expect(onCycleView).not.toHaveBeenCalled();
  });

  it('"전체 N주 보기" 링크 클릭 시 stopPropagation이 호출된다 (line 128)', () => {
    const weeks = Array.from({ length: 7 }, (_, i) => ({
      week: `${i + 1}주차`,
      count: i + 1,
    }));
    const pcMap = new Map(weeks.map((w) => [w.week, 10]));
    const onCycleView = jest.fn();
    renderWithI18n(
      <DashboardWeeklyChart
        {...defaultProps}
        filteredByWeek={weeks}
        problemCountByWeek={pcMap}
        onCycleView={onCycleView}
      />,
    );
    const link = screen.getByText('전체 7주 보기 →');
    // 링크 클릭 시 stopPropagation으로 인해 카드의 onCycleView가 호출되지 않아야 한다
    fireEvent.click(link);
    expect(onCycleView).not.toHaveBeenCalled();
  });
});
