import { render, screen } from '@testing-library/react';
import AnalyticsCharts from '../AnalyticsCharts';
import type { AnalyticsChartsProps } from '../AnalyticsCharts';

// recharts 모킹
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div />,
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
}));

jest.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return {
    FileText: Icon,
    CheckCircle2: Icon,
    Sparkles: Icon,
    Flame: Icon,
    TrendingUp: Icon,
    BarChart3: Icon,
    Tag: Icon,
  };
});

jest.mock('@/components/ui/Card', () => ({
  Card: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="card" {...props}>{children}</div>
  ),
}));

jest.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

const defaultProps: AnalyticsChartsProps = {
  totalSubmissions: 28,
  solvedProblems: 22,
  completionPct: 79,
  avgAIScore: 87,
  streak: 5,
  streakRank: '스터디 내 1위',
  weeklyData: [
    { week: '1월1주', count: 2 },
    { week: '1월2주', count: 3 },
  ],
  aiScoreData: [
    { date: '3/5', score: 92, problem: '두 수의 합' },
  ],
  difficultyData: [
    { tier: 'Silver', count: 8, color: '#808080' },
    { tier: 'Gold', count: 6, color: '#FFD700' },
  ],
  tagData: [
    { tag: 'DP', count: 6 },
    { tag: '그래프', count: 7 },
  ],
  userName: '김민준',
};

describe('AnalyticsCharts', () => {
  it('StatCard 4개의 값을 렌더링한다', () => {
    render(<AnalyticsCharts {...defaultProps} />);
    expect(screen.getByText('28')).toBeInTheDocument();
    expect(screen.getByText('22문제')).toBeInTheDocument();
    expect(screen.getByText('87점')).toBeInTheDocument();
    expect(screen.getByText('5주')).toBeInTheDocument();
  });

  it('주차별 제출 추이 섹션을 표시한다', () => {
    render(<AnalyticsCharts {...defaultProps} />);
    expect(screen.getByText('주차별 제출 추이')).toBeInTheDocument();
  });

  it('AI 점수 추이 섹션과 평균 뱃지를 표시한다', () => {
    render(<AnalyticsCharts {...defaultProps} />);
    expect(screen.getByText('AI 점수 추이')).toBeInTheDocument();
    expect(screen.getByText('평균 87점')).toBeInTheDocument();
  });

  it('난이도별 해결 수를 표시한다', () => {
    render(<AnalyticsCharts {...defaultProps} />);
    expect(screen.getByText('난이도별 해결 수')).toBeInTheDocument();
    expect(screen.getByText('Silver')).toBeInTheDocument();
    expect(screen.getByText('Gold')).toBeInTheDocument();
  });

  it('알고리즘 태그 분포를 표시한다', () => {
    render(<AnalyticsCharts {...defaultProps} />);
    expect(screen.getByText('알고리즘 태그 분포')).toBeInTheDocument();
    expect(screen.getByText('DP')).toBeInTheDocument();
    expect(screen.getByText('그래프')).toBeInTheDocument();
  });

  it('총 해결 문제 수를 표시한다', () => {
    render(<AnalyticsCharts {...defaultProps} />);
    expect(screen.getByText(/총 14문제 해결 완료/)).toBeInTheDocument();
  });
});
