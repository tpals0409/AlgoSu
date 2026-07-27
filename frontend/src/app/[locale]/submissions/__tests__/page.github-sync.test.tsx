/**
 * @file 제출 목록 — GitHub 동기화 실패 배지 오버라이드 테스트 (Issue #13)
 * @domain submission
 * @layer test
 * @related ../page.tsx
 */

import { screen } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/i18n';
import type { Submission, Problem } from '@/lib/api';
import SubmissionsPage from '../page';

// ─── 훅 목킹: 결정적 데이터 주입 ───
const mockSubmissions: { submissions: Submission[] } = { submissions: [] };
const mockProblems: { problems: Problem[] } = { problems: [] };

jest.mock('@/hooks/use-submissions', () => ({
  useSubmissions: () => ({
    submissions: mockSubmissions.submissions,
    isLoading: false,
    error: null,
    mutate: jest.fn(),
  }),
}));

jest.mock('@/hooks/use-problems', () => ({
  useProblems: () => ({
    problems: mockProblems.problems,
    isLoading: false,
    error: null,
    mutate: jest.fn(),
  }),
}));

jest.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), refresh: jest.fn() }),
}));

jest.mock('@/contexts/StudyContext', () => ({
  useStudy: () => ({ currentStudyId: 'study-1' }),
}));

jest.mock('@/hooks/useRequireAuth', () => ({
  useRequireAuth: () => ({ isReady: true, isAuthenticated: true }),
}));

jest.mock('@/hooks/useRequireStudy', () => ({
  useRequireStudy: () => ({ isStudyReady: true }),
}));

jest.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="app-layout">{children}</div>,
}));

jest.mock('@/components/ui/Alert', () => ({
  Alert: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/ui/EmptyState', () => ({
  EmptyState: ({ title }: { title: string }) => <div>{title}</div>,
}));

jest.mock('@/components/ui/DifficultyBadge', () => ({
  DifficultyBadge: () => <span data-testid="difficulty-badge" />,
}));

jest.mock('@/lib/constants', () => ({
  DIFFICULTIES: ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND'],
  DIFFICULTY_LABELS: { BRONZE: 'Bronze', SILVER: 'Silver', GOLD: 'Gold', PLATINUM: 'Platinum', DIAMOND: 'Diamond' },
  DIFF_DOT_STYLE: {},
  DIFF_BADGE_STYLE: {},
}));

jest.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return { FileText: Icon, Search: Icon, Loader2: Icon };
});

function makeProblem(id: string): Problem {
  return {
    id,
    title: `문제 ${id}`,
    difficulty: 'SILVER',
    status: 'ACTIVE',
    deadline: '2026-12-31T00:00:00.000Z',
    description: '',
    weekNumber: '7월1주차',
    allowedLanguages: ['python'],
  };
}

function makeSubmission(over: Partial<Submission>): Submission {
  return {
    id: 'sub-1',
    problemId: 'prob-1',
    language: 'python',
    sagaStep: 'DONE',
    createdAt: '2026-07-27T00:00:00.000Z',
    ...over,
  };
}

describe('SubmissionsPage — GitHub 동기화 실패 배지 (Issue #13)', () => {
  it('sagaStep=DONE이어도 githubSyncStatus=FAILED면 "GitHub 동기화 실패" 배지를 렌더한다', async () => {
    mockProblems.problems = [makeProblem('prob-1')];
    mockSubmissions.submissions = [makeSubmission({ sagaStep: 'DONE', githubSyncStatus: 'FAILED' })];

    renderWithI18n(<SubmissionsPage />);

    expect(await screen.findByText('GitHub 동기화 실패')).toBeInTheDocument();
  });

  it('sagaStep=DONE이어도 githubSyncStatus=TOKEN_INVALID면 "GitHub 동기화 실패" 배지를 렌더한다', async () => {
    mockProblems.problems = [makeProblem('prob-1')];
    mockSubmissions.submissions = [makeSubmission({ sagaStep: 'DONE', githubSyncStatus: 'TOKEN_INVALID' })];

    renderWithI18n(<SubmissionsPage />);

    expect(await screen.findByText('GitHub 동기화 실패')).toBeInTheDocument();
  });

  it('githubSyncStatus=SYNCED면 "GitHub 동기화 실패" 배지를 렌더하지 않는다', async () => {
    mockProblems.problems = [makeProblem('prob-1')];
    mockSubmissions.submissions = [makeSubmission({ sagaStep: 'DONE', githubSyncStatus: 'SYNCED' })];

    renderWithI18n(<SubmissionsPage />);

    await screen.findByTestId('app-layout');
    expect(screen.queryByText('GitHub 동기화 실패')).not.toBeInTheDocument();
  });
});
