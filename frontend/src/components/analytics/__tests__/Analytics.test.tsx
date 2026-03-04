import { render, screen } from '@testing-library/react';
import AnalyticsCharts, { StatCard } from '../AnalyticsCharts';
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

  it('완료율 50~74%이면 success/warning 스타일이 없다', () => {
    const props: AnalyticsChartsProps = { ...defaultProps, myCompletionPct: 60 };
    render(<AnalyticsCharts {...props} />);
    const pctEl = screen.getByText('60%');
    expect(pctEl.className).not.toContain('text-success');
    expect(pctEl.className).not.toContain('text-warning');
  });

  it('total이 0인 주차는 0% 바로 렌더링된다', () => {
    const props: AnalyticsChartsProps = {
      ...defaultProps,
      myWeeklyData: [{ week: '1월1주차', count: 0 }],
      problemCountByWeek: new Map([['1월1주차', 0]]),
    };
    render(<AnalyticsCharts {...props} />);
    expect(screen.getByText('0/0')).toBeInTheDocument();
  });

  it('problemCountByWeek에 없는 주차는 total=0으로 처리된다 (??0 fallback)', () => {
    const props: AnalyticsChartsProps = {
      ...defaultProps,
      myWeeklyData: [{ week: '없는주차', count: 3 }],
      problemCountByWeek: new Map(), // 빈 맵 - get()이 undefined 반환
    };
    render(<AnalyticsCharts {...props} />);
    // total=0이므로 3/0 표시
    expect(screen.getByText('3/0')).toBeInTheDocument();
  });

  it('현재 주차에 해당하는 WeeklyBar는 isCurrent 스타일을 가진다', () => {
    const props: AnalyticsChartsProps = {
      ...defaultProps,
      myWeeklyData: [{ week: '1월3주차', count: 2 }],
      problemCountByWeek: new Map([['1월3주차', 5]]),
      currentWeekLabel: '1월3주차',
    };
    render(<AnalyticsCharts {...props} />);
    // isCurrent일 때 text-primary 스타일 확인
    const weekEl = screen.getByText('1월3주차');
    expect(weekEl.className).toContain('text-primary');
  });

  it('ratio >= 0.7인 태그는 isTop 스타일을 가진다', () => {
    const props: AnalyticsChartsProps = {
      ...defaultProps,
      tagDistribution: [{ tag: 'DP', count: 8, max: 10 }],
    };
    render(<AnalyticsCharts {...props} />);
    // isTop = ratio >= 0.7, gradient-brand 클래스가 적용됨
    const dpTag = screen.getByTitle('DP: 8문제');
    expect(dpTag.className).toContain('gradient-brand');
  });

  it('ratio 0.4~0.69인 태그는 isMid 스타일을 가진다', () => {
    const props: AnalyticsChartsProps = {
      ...defaultProps,
      tagDistribution: [{ tag: 'BFS', count: 5, max: 10 }],
    };
    render(<AnalyticsCharts {...props} />);
    // isMid = 0.4 <= ratio < 0.7, bg-bg-alt border-primary/15
    const bfsTag = screen.getByTitle('BFS: 5문제');
    expect(bfsTag.className).toContain('bg-bg-alt');
    expect(bfsTag.className).toContain('border-primary/15');
  });

  it('ratio < 0.4인 태그는 기본 스타일을 가진다', () => {
    const props: AnalyticsChartsProps = {
      ...defaultProps,
      tagDistribution: [{ tag: '그리디', count: 2, max: 10 }],
    };
    render(<AnalyticsCharts {...props} />);
    const greedyTag = screen.getByTitle('그리디: 2문제');
    expect(greedyTag.className).toContain('border-border');
  });

  it('max가 0인 태그는 ratio=0으로 기본 스타일을 가진다', () => {
    const props: AnalyticsChartsProps = {
      ...defaultProps,
      tagDistribution: [{ tag: '정렬', count: 0, max: 0 }],
    };
    render(<AnalyticsCharts {...props} />);
    const sortTag = screen.getByTitle('정렬: 0문제');
    expect(sortTag.className).toContain('border-border');
  });

  it('isMid 태그의 count 색상은 text-primary이다', () => {
    const props: AnalyticsChartsProps = {
      ...defaultProps,
      tagDistribution: [{ tag: 'BFS', count: 5, max: 10 }],
    };
    render(<AnalyticsCharts {...props} />);
    const countEl = screen.getByText('5');
    expect(countEl.className).toContain('text-primary');
  });
});

describe('StatCard', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const MockIcon = ((props: React.SVGProps<SVGSVGElement>) => <svg {...props} />) as any;

  it('loading=true이면 Skeleton을 표시한다 (line 43 true 분기)', () => {
    render(<StatCard icon={MockIcon} label="테스트" value={42} loading={true} />);
    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
    // loading=true이면 value는 표시되지 않는다
    expect(screen.queryByText('42')).not.toBeInTheDocument();
  });

  it('loading=false이면 값을 표시한다 (line 43 false 분기)', () => {
    render(<StatCard icon={MockIcon} label="테스트" value={42} loading={false} />);
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument();
  });

  it('valueClassName이 전달되면 값 엘리먼트에 적용된다', () => {
    render(<StatCard icon={MockIcon} label="테스트" value="80%" loading={false} valueClassName="text-success" />);
    const el = screen.getByText('80%');
    expect(el.className).toContain('text-success');
  });
});
