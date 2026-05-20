import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/i18n';
import ProblemEditPage from '../page';

const mockProgrammersSearch = jest.fn();

jest.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  usePathname: () => '/problems/1/edit',
  Link: () => null,
  redirect: jest.fn(),
}));
jest.mock('next/navigation', () => ({
  useParams: () => ({ locale: 'ko' }),
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

function makeParams(value: { id: string }) {
  const p = Promise.resolve(value) as Promise<{ id: string }> & { _resolvedValue: { id: string } };
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
  buttonVariants: () => '',
}));

jest.mock('@/components/ui/calendar', () => ({
  Calendar: ({ selected, onSelect }: { selected?: Date; onSelect?: (date: Date | undefined) => void }) => (
    <div data-testid="calendar-mock">
      <button
        type="button"
        data-testid="calendar-pick-2026-04-15"
        onClick={() => onSelect?.(new Date(2026, 3, 15))}
      >
        Pick 2026-04-15
      </button>
      {selected && <span data-testid="calendar-selected">{selected.toISOString()}</span>}
    </div>
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
      category: 'ALGORITHM',
    }),
    update: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({}),
  },
  programmersApi: {
    search: (id: number) => mockProgrammersSearch(id),
  },
  // SSOT 헬퍼는 실제 구현을 사용 (dual-check 로직 drift 방지)
  isProgrammersSqlProblem: jest.requireActual('@/lib/api/external').isProgrammersSqlProblem,
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
  PROBLEM_CATEGORIES: ['ALGORITHM', 'SQL'],
}));

jest.mock('@/lib/problem-form-utils', () => ({
  labelClass: 'label-class',
  selectClass: 'select-class',
  textareaClass: 'textarea-class',
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

  beforeEach(() => {
    mockProgrammersSearch.mockReset();
  });

  it('ADMIN일 때 문제 수정 페이지가 렌더링된다', async () => {
    renderWithI18n(<ProblemEditPage params={defaultParams} />);
    expect(await screen.findByText('문제 수정')).toBeInTheDocument();
  });

  it('AppLayout 안에 렌더링된다', async () => {
    renderWithI18n(<ProblemEditPage params={defaultParams} />);
    expect(await screen.findByTestId('app-layout')).toBeInTheDocument();
  });

  it('뒤로가기 버튼이 표시된다', async () => {
    renderWithI18n(<ProblemEditPage params={defaultParams} />);
    expect(await screen.findByText('문제 상세')).toBeInTheDocument();
  });

  it('수정 완료 버튼이 표시된다', async () => {
    renderWithI18n(<ProblemEditPage params={defaultParams} />);
    expect(await screen.findByText('수정 완료')).toBeInTheDocument();
  });

  it('삭제 버튼이 표시된다', async () => {
    renderWithI18n(<ProblemEditPage params={defaultParams} />);
    expect(await screen.findByText('삭제')).toBeInTheDocument();
  });

  it('카테고리 select가 표시되고 기존 값(ALGORITHM)이 prefill된다', async () => {
    renderWithI18n(<ProblemEditPage params={defaultParams} />);
    const categorySelect = (await screen.findByLabelText('카테고리')) as HTMLSelectElement;
    expect(categorySelect).toBeInTheDocument();
    expect(categorySelect.value).toBe('ALGORITHM');
    expect(categorySelect).not.toBeDisabled();
  });

  it('프로그래머스 SQL 검색 적용 시 기존 카테고리를 SQL로 덮어쓰고 select를 비활성화한다', async () => {
    mockProgrammersSearch.mockResolvedValue({
      problemId: 12117,
      title: '있었는데요 없었습니다',
      difficulty: 'SILVER',
      level: 2,
      sourceUrl: 'https://school.programmers.co.kr/learn/courses/30/lessons/12117',
      tags: ['sql'],
      category: 'sql',
    });

    const params = makeParams({ id: 'prob-1' });
    renderWithI18n(<ProblemEditPage params={params} />);

    const categorySelect = (await screen.findByLabelText('카테고리')) as HTMLSelectElement;
    expect(categorySelect.value).toBe('ALGORITHM');

    // 기본 활성 플랫폼은 BOJ(로드된 sourcePlatform) → 프로그래머스 탭으로 전환
    fireEvent.click(screen.getByRole('tab', { name: '프로그래머스' }));

    const searchInput = screen.getByPlaceholderText('문제 번호 (예: 42839)');
    fireEvent.change(searchInput, { target: { value: '12117' } });
    fireEvent.click(screen.getByRole('button', { name: '검색' }));

    await waitFor(() => {
      expect(categorySelect.value).toBe('SQL');
    });
    expect(categorySelect).toBeDisabled();
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
    renderWithI18n(<ProblemEditPage params={params} />);
    expect(await screen.findByText('문제 수정은 관리자만 가능합니다.')).toBeInTheDocument();

    // Restore
    studyCtx.useStudy = original;
  });
});
