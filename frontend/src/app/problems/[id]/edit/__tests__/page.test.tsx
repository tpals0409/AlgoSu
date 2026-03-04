import { render, screen } from '@testing-library/react';
import ProblemEditPage from '../page';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  usePathname: () => '/problems/1/edit',
}));

jest.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'light', setTheme: jest.fn() }),
}));

// mock React.use for params promise
jest.mock('react', () => {
  const actual = jest.requireActual('react');
  return {
    ...actual,
    use: (arg: unknown) => {
      if (arg && typeof arg === 'object' && '_resolvedValue' in (arg as Record<string, unknown>)) {
        return (arg as { _resolvedValue: unknown })._resolvedValue;
      }
      return actual.use(arg);
    },
  };
});

function makeParams(value: Record<string, string>) {
  const p = Promise.resolve(value) as Promise<Record<string, string>> & { _resolvedValue: Record<string, string> };
  p._resolvedValue = value;
  return p;
}

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    user: { email: 'test@example.com', avatarPreset: 'default' },
    logout: jest.fn(),
  }),
}));

jest.mock('@/contexts/StudyContext', () => ({
  useStudy: () => ({
    currentStudyId: 'study-1',
    currentStudyName: 'Test Study',
    currentStudyRole: 'ADMIN',
    studies: [{ id: 'study-1', name: 'Test Study' }],
    setCurrentStudy: jest.fn(),
    studiesLoaded: true,
  }),
}));

jest.mock('@/hooks/useRequireAuth', () => ({
  useRequireAuth: () => ({ isReady: true, isAuthenticated: true }),
}));

jest.mock('@/hooks/useRequireStudy', () => ({
  useRequireStudy: jest.fn(),
}));

jest.mock('@/hooks/useBojSearch', () => ({
  useBojSearch: () => ({
    bojQuery: '',
    setBojQuery: jest.fn(),
    bojSearching: false,
    bojError: null,
    setBojError: jest.fn(),
    bojResult: null,
    bojApplied: false,
    handleBojSearch: jest.fn(),
    handleBojKeyDown: jest.fn(),
    handleBojReset: jest.fn(),
  }),
}));

jest.mock('@/hooks/useLanguageToggle', () => ({
  useLanguageToggle: () => jest.fn(),
}));

jest.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-layout">{children}</div>
  ),
}));

jest.mock('@/components/ui/Card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/ui/Button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

jest.mock('@/components/ui/Input', () => ({
  Input: ({ label, ...props }: { label?: string } & React.InputHTMLAttributes<HTMLInputElement>) => (
    <div>
      {label && <label>{label}</label>}
      <input {...props} />
    </div>
  ),
}));

jest.mock('@/components/ui/Alert', () => ({
  Alert: ({ children }: { children: React.ReactNode }) => <div data-testid="alert">{children}</div>,
}));

jest.mock('@/components/ui/Badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

jest.mock('@/components/ui/BackBtn', () => ({
  BackBtn: ({ label }: { label: string }) => <a>{label}</a>,
}));

jest.mock('@/components/ui/DifficultyBadge', () => ({
  DifficultyBadge: () => <span data-testid="difficulty-badge" />,
}));

jest.mock('@/components/ui/Skeleton', () => ({
  Skeleton: () => <div data-testid="skeleton" />,
}));

jest.mock('@/components/ui/LoadingSpinner', () => ({
  InlineSpinner: () => <span data-testid="inline-spinner" />,
}));

jest.mock('@/lib/api', () => ({
  problemApi: {
    findById: jest.fn().mockResolvedValue({
      id: 'prob-1',
      title: 'Two Sum',
      description: 'test desc',
      difficulty: 'GOLD',
      weekNumber: '1월1주차',
      deadline: '2025-01-10T00:00:00.000Z',
      allowedLanguages: ['python', 'javascript'],
      sourceUrl: 'https://boj.kr/1000',
      sourcePlatform: 'BOJ',
      status: 'ACTIVE',
    }),
    update: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({}),
  },
}));

jest.mock('@/lib/constants', () => ({
  DIFFICULTIES: ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND', 'RUBY'],
  DIFFICULTY_LABELS: { BRONZE: '브론즈', SILVER: '실버', GOLD: '골드', PLATINUM: '플래티넘', DIAMOND: '다이아', RUBY: '루비' },
  LANGUAGES: [
    { label: 'Python', value: 'python' },
    { label: 'JavaScript', value: 'javascript' },
  ],
  LANGUAGE_VALUES: ['python', 'javascript'],
  PROBLEM_STATUSES: ['DRAFT', 'ACTIVE', 'CLOSED'],
  PROBLEM_STATUS_LABELS: { DRAFT: '초안', ACTIVE: '활성', CLOSED: '종료' },
}));

jest.mock('@/lib/problem-form-utils', () => ({
  labelClass: 'label-class',
  selectClass: 'select-class',
  textareaClass: 'textarea-class',
  getWeekOptions: () => ['1월1주차', '1월2주차'],
  getWeekDates: () => [{ value: '2025-01-10', label: '금요일 (1/10)' }],
  matchDeadlineToWeekDate: () => '2025-01-10',
  validateProblemForm: () => ({}),
}));

jest.mock('@/lib/avatars', () => ({
  getAvatarSrc: () => '/avatar.png',
}));

jest.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return { Search: Icon, ExternalLink: Icon, Trash2: Icon, FileText: Icon, Settings: Icon, X: Icon };
});

describe('ProblemEditPage', () => {
  const defaultParams = makeParams({ id: 'prob-1' });

  it('ADMIN일 때 문제 수정 페이지가 렌더링된다', async () => {
    render(<ProblemEditPage params={defaultParams} />);
    expect(await screen.findByText('문제 수정')).toBeInTheDocument();
  });

  it('AppLayout 안에 렌더링된다', async () => {
    render(<ProblemEditPage params={defaultParams} />);
    expect(await screen.findByTestId('app-layout')).toBeInTheDocument();
  });

  it('뒤로가기 버튼이 표시된다', async () => {
    render(<ProblemEditPage params={defaultParams} />);
    expect(await screen.findByText('문제 상세')).toBeInTheDocument();
  });

  it('수정 완료 버튼이 표시된다', async () => {
    render(<ProblemEditPage params={defaultParams} />);
    expect(await screen.findByText('수정 완료')).toBeInTheDocument();
  });

  it('삭제 버튼이 표시된다', async () => {
    render(<ProblemEditPage params={defaultParams} />);
    expect(await screen.findByText('삭제')).toBeInTheDocument();
  });
});

describe('ProblemEditPage - non-ADMIN', () => {
  it('ADMIN이 아니면 권한 오류 메시지가 표시된다', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const studyCtx = require('@/contexts/StudyContext');
    const original = studyCtx.useStudy;
    studyCtx.useStudy = () => ({
      currentStudyId: 'study-1',
      currentStudyName: 'Test Study',
      currentStudyRole: 'MEMBER',
      studies: [{ id: 'study-1', name: 'Test Study' }],
      setCurrentStudy: jest.fn(),
      studiesLoaded: true,
    });

    const params = makeParams({ id: 'prob-1' });
    render(<ProblemEditPage params={params} />);
    expect(await screen.findByText('문제 수정은 관리자만 가능합니다.')).toBeInTheDocument();

    // Restore
    studyCtx.useStudy = original;
  });
});
