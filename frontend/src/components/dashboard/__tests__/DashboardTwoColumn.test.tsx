import { render, screen } from '@testing-library/react';
import DashboardTwoColumn from '../DashboardTwoColumn';
import type { DashboardTwoColumnProps } from '../DashboardTwoColumn';
import type { Submission, Problem } from '@/lib/api';

jest.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return {
    ArrowRight: Icon,
    CheckCircle2: Icon,
    Clock: Icon,
  };
});

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

jest.mock('@/components/ui/Card', () => ({
  Card: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="card" {...props}>{children}</div>
  ),
}));

jest.mock('@/components/ui/Badge', () => ({
  Badge: ({ children, variant }: { children: React.ReactNode; variant?: string }) => (
    <span data-testid={`badge-${variant ?? 'default'}`}>{children}</span>
  ),
}));

jest.mock('@/components/ui/DifficultyBadge', () => ({
  DifficultyBadge: ({ difficulty }: { difficulty: string }) => (
    <span data-testid="difficulty-badge">{difficulty}</span>
  ),
}));

jest.mock('@/components/ui/Skeleton', () => ({
  Skeleton: () => <div data-testid="skeleton" />,
}));

jest.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

jest.mock('@/lib/constants', () => ({
  SAGA_STEP_CONFIG: {
    DB_SAVED: { label: '저장됨', variant: 'muted' },
    GITHUB_QUEUED: { label: 'GitHub 대기', variant: 'info' },
    AI_QUEUED: { label: 'AI 분석 대기', variant: 'warning' },
    DONE: { label: '완료', variant: 'success' },
    FAILED: { label: '실패', variant: 'error' },
  },
}));

const makeSubmission = (overrides: Partial<Submission> = {}): Submission => ({
  id: 'sub-1',
  problemId: 'p-1',
  language: 'python',
  sagaStep: 'DONE',
  createdAt: new Date().toISOString(),
  ...overrides,
});

const makeProblem = (overrides: Partial<Problem> = {}): Problem => ({
  id: 'p-1',
  title: '두 수의 합',
  difficulty: 'SILVER',
  level: 3,
  status: 'ACTIVE',
  deadline: new Date(Date.now() + 86400000 * 3).toISOString(),
  description: '설명',
  weekNumber: '1월3주차',
  allowedLanguages: ['python'],
  ...overrides,
});

const defaultProps: DashboardTwoColumnProps = {
  recentSubmissions: [],
  upcomingDeadlines: [],
  submittedProblemIds: new Set(),
  problemTitleMap: new Map(),
  isLoading: false,
  fadeStyle: {},
};

describe('DashboardTwoColumn', () => {
  it('최근 제출과 마감 임박 헤더를 렌더링한다', () => {
    render(<DashboardTwoColumn {...defaultProps} />);
    expect(screen.getByText('최근 제출')).toBeInTheDocument();
    expect(screen.getByText('마감 임박 문제')).toBeInTheDocument();
  });

  it('로딩 중에는 Skeleton을 표시한다', () => {
    render(<DashboardTwoColumn {...defaultProps} isLoading={true} />);
    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
  });

  it('제출이 없으면 안내 메시지를 표시한다', () => {
    render(<DashboardTwoColumn {...defaultProps} />);
    expect(screen.getByText('아직 제출 내역이 없습니다')).toBeInTheDocument();
  });

  it('마감 문제가 없으면 안내 메시지를 표시한다', () => {
    render(<DashboardTwoColumn {...defaultProps} />);
    expect(screen.getByText('마감 예정인 문제가 없습니다')).toBeInTheDocument();
  });

  it('제출 목록을 렌더링한다', () => {
    const submissions = [
      makeSubmission({ id: 's-1', problemTitle: '두 수의 합', sagaStep: 'DONE' }),
      makeSubmission({ id: 's-2', problemTitle: '최단 경로', sagaStep: 'AI_QUEUED' }),
    ];
    render(
      <DashboardTwoColumn {...defaultProps} recentSubmissions={submissions} />,
    );
    expect(screen.getByText('두 수의 합')).toBeInTheDocument();
    expect(screen.getByText('최단 경로')).toBeInTheDocument();
    expect(screen.getByText('완료')).toBeInTheDocument();
    expect(screen.getByText('AI 분석 대기')).toBeInTheDocument();
  });

  it('마감 임박 문제를 렌더링한다', () => {
    const problems = [
      makeProblem({ id: 'p-1', title: '두 수의 합', deadline: new Date(Date.now() + 86400000 * 2).toISOString() }),
    ];
    render(
      <DashboardTwoColumn {...defaultProps} upcomingDeadlines={problems} />,
    );
    expect(screen.getByText('두 수의 합')).toBeInTheDocument();
  });

  it('제출된 문제에 "제출 완료" 뱃지를 표시한다', () => {
    const problems = [makeProblem({ id: 'p-1' })];
    render(
      <DashboardTwoColumn
        {...defaultProps}
        upcomingDeadlines={problems}
        submittedProblemIds={new Set(['p-1'])}
      />,
    );
    expect(screen.getByText('제출 완료')).toBeInTheDocument();
  });

  it('problemTitleMap에서 제목을 조회한다', () => {
    const submissions = [
      makeSubmission({ id: 's-1', problemId: 'p-99', problemTitle: undefined }),
    ];
    const titleMap = new Map([['p-99', '맵에서 가져온 제목']]);
    render(
      <DashboardTwoColumn
        {...defaultProps}
        recentSubmissions={submissions}
        problemTitleMap={titleMap}
      />,
    );
    expect(screen.getByText('맵에서 가져온 제목')).toBeInTheDocument();
  });

  it('전체 보기 링크가 올바른 경로를 가진다', () => {
    render(<DashboardTwoColumn {...defaultProps} />);
    const links = screen.getAllByText('전체 보기');
    expect(links[0].closest('a')).toHaveAttribute('href', '/submissions');
    expect(links[1].closest('a')).toHaveAttribute('href', '/problems');
  });
});
