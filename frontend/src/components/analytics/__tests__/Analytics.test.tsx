import { render, screen } from '@testing-library/react';
import AnalyticsCharts from '../AnalyticsCharts';
import type { AnalyticsChartsProps } from '../AnalyticsCharts';

jest.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return {
    BarChart3: Icon,
    FileText: Icon,
    CheckCircle2: Icon,
    Calendar: Icon,
  };
});

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
  CardContent: ({ children }: React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="card-content">{children}</div>
  ),
}));

jest.mock('@/components/ui/Skeleton', () => ({
  Skeleton: () => <div data-testid="skeleton" />,
}));

jest.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

const defaultProps: AnalyticsChartsProps = {
  myStatsCount: 10,
  myStatsDoneCount: 7,
  myCompletionPct: 70,
  myWeekCount: 3,
  myWeeklyData: [],
  problemCountByWeek: new Map(),
  currentWeekLabel: '1월3주차',
  tagDistribution: [],
};

describe('AnalyticsCharts', () => {
  it('StatCard 4개를 렌더링한다', () => {
    render(<AnalyticsCharts {...defaultProps} />);
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('70%')).toBeInTheDocument();
    expect(screen.getByText('3주')).toBeInTheDocument();
  });

  it('StatCard 라벨을 표시한다', () => {
    render(<AnalyticsCharts {...defaultProps} />);
    expect(screen.getByText('내 제출')).toBeInTheDocument();
    expect(screen.getByText('AI 분석 완료')).toBeInTheDocument();
    expect(screen.getByText('내 완료율')).toBeInTheDocument();
    expect(screen.getByText('참여 주차')).toBeInTheDocument();
  });

  it('주차별 추이 섹션 제목을 표시한다', () => {
    render(<AnalyticsCharts {...defaultProps} />);
    expect(screen.getByText('나의 주차별 풀이 추이')).toBeInTheDocument();
  });

  it('풀이 기록이 없으면 안내 메시지를 표시한다', () => {
    render(<AnalyticsCharts {...defaultProps} />);
    expect(screen.getByText('아직 풀이 기록이 없습니다.')).toBeInTheDocument();
  });

  it('주차별 데이터가 있으면 WeeklyBar를 렌더링한다', () => {
    const props: AnalyticsChartsProps = {
      ...defaultProps,
      myWeeklyData: [
        { week: '1월1주차', count: 3 },
        { week: '1월2주차', count: 5 },
      ],
      problemCountByWeek: new Map([
        ['1월1주차', 5],
        ['1월2주차', 5],
      ]),
    };
    render(<AnalyticsCharts {...props} />);
    expect(screen.getByText('1월1주차')).toBeInTheDocument();
    expect(screen.getByText('1월2주차')).toBeInTheDocument();
    expect(screen.getByText('3/5')).toBeInTheDocument();
    expect(screen.getByText('5/5')).toBeInTheDocument();
  });

  it('완주한 주차에 "완주" 텍스트를 표시한다', () => {
    const props: AnalyticsChartsProps = {
      ...defaultProps,
      myWeeklyData: [{ week: '1월1주차', count: 5 }],
      problemCountByWeek: new Map([['1월1주차', 5]]),
    };
    render(<AnalyticsCharts {...props} />);
    expect(screen.getByText('완주')).toBeInTheDocument();
  });

  it('tagDistribution이 비어있으면 알고리즘 유형 섹션을 표시하지 않는다', () => {
    render(<AnalyticsCharts {...defaultProps} />);
    expect(screen.queryByText('내가 푼 알고리즘 유형')).not.toBeInTheDocument();
  });

  it('tagDistribution이 있으면 태그와 카운트를 렌더링한다', () => {
    const props: AnalyticsChartsProps = {
      ...defaultProps,
      tagDistribution: [
        { tag: 'DP', count: 10, max: 12 },
        { tag: 'BFS', count: 5, max: 12 },
        { tag: '그리디', count: 2, max: 12 },
      ],
    };
    render(<AnalyticsCharts {...props} />);
    expect(screen.getByText('내가 푼 알고리즘 유형')).toBeInTheDocument();
    expect(screen.getByText('DP')).toBeInTheDocument();
    expect(screen.getByText('BFS')).toBeInTheDocument();
    expect(screen.getByText('그리디')).toBeInTheDocument();
    expect(screen.getByText('총 17문제')).toBeInTheDocument();
  });

  it('완료율 75% 이상이면 success 스타일을 적용한다', () => {
    const props: AnalyticsChartsProps = { ...defaultProps, myCompletionPct: 80 };
    render(<AnalyticsCharts {...props} />);
    const pctEl = screen.getByText('80%');
    expect(pctEl.className).toContain('text-success');
  });

  it('완료율 50% 미만이면 warning 스타일을 적용한다', () => {
    const props: AnalyticsChartsProps = { ...defaultProps, myCompletionPct: 30 };
    render(<AnalyticsCharts {...props} />);
    const pctEl = screen.getByText('30%');
    expect(pctEl.className).toContain('text-warning');
  });
});
