import { screen } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/i18n';
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
  CardHeader: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="card-header" {...props}>{children}</div>
  ),
  CardTitle: ({ children }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3>{children}</h3>
  ),
}));

jest.mock('@/components/ui/Badge', () => ({
  Badge: ({ children, variant }: { children: React.ReactNode; variant?: string }) => (
    <span data-testid={`badge-${variant ?? 'default'}`}>{children}</span>
  ),
}));

jest.mock('@/components/ui/DifficultyBadge', () => ({
  DifficultyBadge: ({ difficulty, sourcePlatform, level }: { difficulty: string | null; sourcePlatform?: string | null; level?: number | null }) => {
    if (sourcePlatform !== 'PROGRAMMERS' && !difficulty) return null;
    const label = sourcePlatform === 'PROGRAMMERS' ? `Lv.${level ?? 0}` : difficulty;
    return <span data-testid="difficulty-badge">{label}</span>;
  },
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
  DIFF_DOT_STYLE: {},
  DIFF_BADGE_STYLE: {},
  toTierLevel: (level?: number | null) => level ?? null,
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
  allProblems: [],
  isLoading: false,
  fadeStyle: {},
};

describe('DashboardTwoColumn', () => {
  it('최근 제출 헤더를 렌더링한다', () => {
    renderWithI18n(<DashboardTwoColumn {...defaultProps} />);
    expect(screen.getByText('최근 제출')).toBeInTheDocument();
  });

  it('마감 임박 문제가 있으면 마감 임박 헤더를 렌더링한다', () => {
    const problems = [makeProblem({ id: 'p-1' })];
    renderWithI18n(<DashboardTwoColumn {...defaultProps} upcomingDeadlines={problems} />);
    expect(screen.getByText('최근 제출')).toBeInTheDocument();
    expect(screen.getByText('마감 임박 문제')).toBeInTheDocument();
  });

  it('마감 임박 문제가 없으면 마감 임박 섹션을 렌더링하지 않는다', () => {
    renderWithI18n(<DashboardTwoColumn {...defaultProps} />);
    expect(screen.queryByText('마감 임박 문제')).not.toBeInTheDocument();
  });

  it('로딩 중에는 Skeleton을 표시한다', () => {
    renderWithI18n(<DashboardTwoColumn {...defaultProps} isLoading={true} />);
    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
  });

  it('제출이 없으면 안내 메시지를 표시한다', () => {
    renderWithI18n(<DashboardTwoColumn {...defaultProps} />);
    expect(screen.getByText('아직 제출 내역이 없습니다')).toBeInTheDocument();
  });

  it('제출 목록을 렌더링한다', () => {
    const submissions = [
      makeSubmission({ id: 's-1', problemId: 'p-1', problemTitle: '두 수의 합', sagaStep: 'DONE' }),
      makeSubmission({ id: 's-2', problemId: 'p-2', problemTitle: '최단 경로', sagaStep: 'AI_QUEUED' }),
    ];
    const problems = [makeProblem({ id: 'p-1' }), makeProblem({ id: 'p-2', title: '최단 경로' })];
    renderWithI18n(
      <DashboardTwoColumn {...defaultProps} recentSubmissions={submissions} allProblems={problems} />,
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
    renderWithI18n(
      <DashboardTwoColumn {...defaultProps} upcomingDeadlines={problems} />,
    );
    expect(screen.getByText('두 수의 합')).toBeInTheDocument();
  });

  it('제출된 문제에 "제출 완료" 뱃지를 표시한다', () => {
    const problems = [makeProblem({ id: 'p-1' })];
    renderWithI18n(
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
    renderWithI18n(
      <DashboardTwoColumn
        {...defaultProps}
        recentSubmissions={submissions}
        problemTitleMap={titleMap}
        allProblems={[makeProblem({ id: 'p-99' })]}
      />,
    );
    expect(screen.getByText('맵에서 가져온 제목')).toBeInTheDocument();
  });

  it('전체 보기 링크가 올바른 경로를 가진다', () => {
    renderWithI18n(<DashboardTwoColumn {...defaultProps} />);
    const links = screen.getAllByText('전체 보기');
    expect(links[0].closest('a')).toHaveAttribute('href', '/submissions');
  });

  it('방금 전 제출은 "방금 전"을 표시한다', () => {
    const submissions = [makeSubmission({
      id: 's-1', problemId: 'p-1', problemTitle: '테스트',
      createdAt: new Date(Date.now() - 30000).toISOString(), // 30초 전
    })];
    renderWithI18n(<DashboardTwoColumn {...defaultProps} recentSubmissions={submissions} allProblems={[makeProblem({ id: 'p-1' })]} />);
    expect(screen.getByText('방금 전')).toBeInTheDocument();
  });

  it('2시간 전 제출은 "N시간 전"을 표시한다', () => {
    const submissions = [makeSubmission({
      id: 's-1', problemId: 'p-1', problemTitle: '테스트',
      createdAt: new Date(Date.now() - 2 * 3600000).toISOString(), // 2시간 전
    })];
    renderWithI18n(<DashboardTwoColumn {...defaultProps} recentSubmissions={submissions} allProblems={[makeProblem({ id: 'p-1' })]} />);
    expect(screen.getByText('2시간 전')).toBeInTheDocument();
  });

  it('8일 전 제출은 "M.D" 형식 날짜를 표시한다', () => {
    const submissions = [makeSubmission({
      id: 's-1', problemId: 'p-1', problemTitle: '테스트',
      createdAt: new Date(Date.now() - 8 * 86400000).toISOString(), // 8일 전
    })];
    renderWithI18n(<DashboardTwoColumn {...defaultProps} recentSubmissions={submissions} allProblems={[makeProblem({ id: 'p-1' })]} />);
    // M.D 형식의 날짜가 있는지 확인 (예: "1.1")
    const datePattern = /\d+\.\d+/;
    const timeEl = screen.getByText(datePattern);
    expect(timeEl).toBeInTheDocument();
  });

  it('마감 1시간 미만 문제는 "곧 마감"을 표시한다', () => {
    const problems = [makeProblem({
      id: 'p-1', title: '긴급 문제',
      deadline: new Date(Date.now() + 30 * 60000).toISOString(), // 30분 후
    })];
    renderWithI18n(<DashboardTwoColumn {...defaultProps} upcomingDeadlines={problems} />);
    expect(screen.getByText('곧 마감')).toBeInTheDocument();
  });

  it('마감 몇 시간 남은 문제는 "N시간 남음"을 표시한다', () => {
    const problems = [makeProblem({
      id: 'p-1', title: '시간 문제',
      // 정확히 2시간 + 10분 후 마감 (diffDays=0, diffHours>=1)
      deadline: new Date(Date.now() + 2 * 3600000 + 600000).toISOString(),
    })];
    renderWithI18n(<DashboardTwoColumn {...defaultProps} upcomingDeadlines={problems} />);
    expect(screen.getByText(/\d+시간 남음/)).toBeInTheDocument();
  });

  it('제목 없는 제출은 problemId를 잘라 표시한다', () => {
    const submissions = [makeSubmission({
      id: 's-1', problemId: 'abcdefgh-1234', problemTitle: undefined,
    })];
    renderWithI18n(<DashboardTwoColumn {...defaultProps} recentSubmissions={submissions} problemTitleMap={new Map()} allProblems={[makeProblem({ id: 'abcdefgh-1234' })]} />);
    expect(screen.getByText('문제 abcdefgh')).toBeInTheDocument();
  });

  it('difficulty가 없는 문제는 DifficultyBadge를 표시하지 않는다', () => {
    const problems = [makeProblem({ id: 'p-1', difficulty: undefined })];
    renderWithI18n(<DashboardTwoColumn {...defaultProps} upcomingDeadlines={problems} />);
    expect(screen.queryByTestId('difficulty-badge')).not.toBeInTheDocument();
  });

  it('30분 전 제출은 "N분 전"을 표시한다', () => {
    const submissions = [makeSubmission({
      id: 's-1', problemId: 'p-1', problemTitle: '분 테스트',
      createdAt: new Date(Date.now() - 30 * 60000).toISOString(), // 30분 전
    })];
    renderWithI18n(<DashboardTwoColumn {...defaultProps} recentSubmissions={submissions} allProblems={[makeProblem({ id: 'p-1' })]} />);
    expect(screen.getByText('30분 전')).toBeInTheDocument();
  });

  it('3일 전 제출은 "N일 전"을 표시한다', () => {
    const submissions = [makeSubmission({
      id: 's-1', problemId: 'p-1', problemTitle: '일 테스트',
      createdAt: new Date(Date.now() - 3 * 86400000).toISOString(), // 3일 전
    })];
    renderWithI18n(<DashboardTwoColumn {...defaultProps} recentSubmissions={submissions} allProblems={[makeProblem({ id: 'p-1' })]} />);
    expect(screen.getByText('3일 전')).toBeInTheDocument();
  });

  it('제출이 여러 개이면 모두 렌더링된다', () => {
    const submissions = [
      makeSubmission({ id: 's-1', problemId: 'p-1', problemTitle: '첫 번째', sagaStep: 'DONE' }),
      makeSubmission({ id: 's-2', problemId: 'p-2', problemTitle: '두 번째', sagaStep: 'DONE' }),
      makeSubmission({ id: 's-3', problemId: 'p-3', problemTitle: '세 번째', sagaStep: 'DONE' }),
    ];
    const problems = [makeProblem({ id: 'p-1' }), makeProblem({ id: 'p-2' }), makeProblem({ id: 'p-3' })];
    renderWithI18n(<DashboardTwoColumn {...defaultProps} recentSubmissions={submissions} allProblems={problems} />);
    expect(screen.getByText('첫 번째')).toBeInTheDocument();
    expect(screen.getByText('두 번째')).toBeInTheDocument();
    expect(screen.getByText('세 번째')).toBeInTheDocument();
  });

  it('SAGA_STEP_CONFIG에 없는 sagaStep은 raw step 값을 표시한다', () => {
    const submissions = [makeSubmission({ id: 's-1', problemId: 'p-1', problemTitle: '테스트', sagaStep: 'UNKNOWN_STEP' as never })];
    renderWithI18n(<DashboardTwoColumn {...defaultProps} recentSubmissions={submissions} allProblems={[makeProblem({ id: 'p-1' })]} />);
    expect(screen.getByText('UNKNOWN_STEP')).toBeInTheDocument();
  });

  it('마감 임박 문제가 여러 개이면 모두 렌더링된다', () => {
    const problems = [
      makeProblem({ id: 'p-1', title: '첫 번째 문제', deadline: new Date(Date.now() + 86400000).toISOString() }),
      makeProblem({ id: 'p-2', title: '마지막 문제', deadline: new Date(Date.now() + 86400000 * 2).toISOString() }),
    ];
    renderWithI18n(<DashboardTwoColumn {...defaultProps} upcomingDeadlines={problems} />);
    expect(screen.getByText('첫 번째 문제')).toBeInTheDocument();
    expect(screen.getByText('마지막 문제')).toBeInTheDocument();
  });
});
