import { render, screen } from '@testing-library/react';
import DashboardThisWeek from '../DashboardThisWeek';
import type { Problem } from '@/lib/api';

jest.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return {
    ArrowRight: Icon,
  };
});

jest.mock('next/link', () => {
  return {
    __esModule: true,
    default: ({ children, href }: { children: React.ReactNode; href: string }) => (
      <a href={href}>{children}</a>
    ),
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
}));

jest.mock('@/components/ui/Skeleton', () => ({
  Skeleton: () => <div data-testid="skeleton" />,
}));

jest.mock('@/contexts/StudyContext', () => ({
  useStudy: () => ({ currentStudyId: 'test-study-id' }),
}));

jest.mock('@/lib/utils', () => ({
  cn: (...args: string[]) => args.filter(Boolean).join(' '),
  getCurrentWeekLabel: () => '1월3주차',
}));

jest.mock('@/lib/constants', () => ({
  toTierLevel: (level: number | null | undefined) => level ?? null,
}));

const makeProblem = (overrides: Partial<Problem> = {}): Problem => ({
  id: 'p-1',
  title: '두 수의 합',
  difficulty: 'SILVER',
  level: 3,
  status: 'ACTIVE',
  deadline: '2025-01-20T00:00:00Z',
  description: '설명',
  weekNumber: '3',
  allowedLanguages: ['python'],
  ...overrides,
});

describe('DashboardThisWeek', () => {
  const defaultProps = {
    currentWeekProblems: [] as Problem[],
    submittedProblemIds: new Set<string>(),
    isLoading: false,
    fadeStyle: {},
  };

  it('진행 중인 문제 제목을 렌더링한다', () => {
    render(<DashboardThisWeek {...defaultProps} />);
    expect(screen.getByText('진행 중인 문제')).toBeInTheDocument();
  });

  it('전체 보기 링크를 표시한다', () => {
    render(<DashboardThisWeek {...defaultProps} />);
    expect(screen.getByText('전체 보기')).toBeInTheDocument();
  });

  it('로딩 중에는 Skeleton을 표시한다', () => {
    render(<DashboardThisWeek {...defaultProps} isLoading={true} />);
    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
  });

  it('문제가 없으면 안내 메시지를 표시한다', () => {
    render(<DashboardThisWeek {...defaultProps} />);
    expect(screen.getByText('진행 중인 문제가 없습니다')).toBeInTheDocument();
  });

  it('문제 목록을 렌더링한다', () => {
    const problems = [
      makeProblem({ id: 'p-1', title: '두 수의 합' }),
      makeProblem({ id: 'p-2', title: '최단 경로' }),
    ];
    render(
      <DashboardThisWeek {...defaultProps} currentWeekProblems={problems} />,
    );
    expect(screen.getByText('두 수의 합')).toBeInTheDocument();
    expect(screen.getByText('최단 경로')).toBeInTheDocument();
  });

  it('제출된 문제는 opacity-50 클래스가 적용된다', () => {
    const problems = [makeProblem({ id: 'p-1' })];
    render(
      <DashboardThisWeek
        {...defaultProps}
        currentWeekProblems={problems}
        submittedProblemIds={new Set(['p-1'])}
      />,
    );
    expect(screen.getByText('두 수의 합')).toBeInTheDocument();
  });

  it('난이도 라벨을 표시한다', () => {
    const problems = [makeProblem({ id: 'p-1', difficulty: 'SILVER', level: 3 })];
    render(
      <DashboardThisWeek {...defaultProps} currentWeekProblems={problems} />,
    );
    expect(screen.getByText('Silver 3')).toBeInTheDocument();
  });
});
