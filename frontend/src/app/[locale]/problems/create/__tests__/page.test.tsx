import { screen } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/i18n';
import ProblemCreatePage from '../page';

jest.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  usePathname: () => '/problems/create',
  Link: () => null,
  redirect: jest.fn(),
}));
jest.mock('next/navigation', () => ({
  useParams: () => ({ locale: 'ko' }),
  usePathname: () => '/problems/create',
}));

jest.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'light', setTheme: jest.fn() }),
}));

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
  useRequireStudy: () => ({ isStudyReady: true }),
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

jest.mock('@/hooks/useProgrammersSearch', () => ({
  useProgrammersSearch: () => ({
    programmersQuery: '',
    setProgrammersQuery: jest.fn(),
    programmersSearching: false,
    programmersError: null,
    setProgrammersError: jest.fn(),
    programmersResult: null,
    programmersApplied: false,
    handleProgrammersSearch: jest.fn(),
    handleProgrammersKeyDown: jest.fn(),
    handleProgrammersReset: jest.fn(),
  }),
}));

jest.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-layout">{children}</div>
  ),
}));

jest.mock('@/components/layout/NotificationBell', () => ({
  NotificationBell: () => <div data-testid="notification-bell" />,
}));

jest.mock('@/components/ui/Card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/ui/Badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span data-testid="badge">{children}</span>,
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

jest.mock('@/components/ui/Input', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  const MockInput = React.forwardRef(({ label, ...props }: { label?: string } & React.InputHTMLAttributes<HTMLInputElement>, ref: React.Ref<HTMLInputElement>) => (
    <div>
      {label && <label>{label}</label>}
      <input ref={ref} {...props} />
    </div>
  ));
  MockInput.displayName = 'MockInput';
  return { Input: MockInput };
});

jest.mock('@/components/ui/Alert', () => ({
  Alert: ({ children }: { children: React.ReactNode }) => <div data-testid="alert">{children}</div>,
}));

jest.mock('@/components/ui/BackBtn', () => ({
  BackBtn: ({ label }: { label: string }) => <button>{label}</button>,
}));

jest.mock('@/components/ui/DifficultyBadge', () => ({
  DifficultyBadge: () => <span data-testid="difficulty-badge" />,
}));

jest.mock('@/components/ui/LoadingSpinner', () => ({
  InlineSpinner: () => <span data-testid="inline-spinner" />,
  LoadingSpinner: () => <div data-testid="loading-spinner" />,
}));

jest.mock('@/lib/api', () => ({
  problemApi: {
    create: jest.fn().mockResolvedValue({ id: 'p1', title: 'Test' }),
  },
  studyApi: {
    notifyProblemCreated: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@/lib/constants', () => ({
  DIFFICULTIES: ['EASY', 'MEDIUM', 'HARD'],
  DIFFICULTY_LABELS: { EASY: '쉬움', MEDIUM: '보통', HARD: '어려움' },
  LANGUAGES: [
    { value: 'python', label: 'Python' },
    { value: 'javascript', label: 'JavaScript' },
  ],
  LANGUAGE_VALUES: ['python', 'javascript'],
}));

jest.mock('@/lib/problem-form-utils', () => ({
  labelClass: 'label-class',
  selectClass: 'select-class',
  textareaClass: 'textarea-class',
  getCurrentWeekLabel: () => 'Week 1',
  getWeekOptions: () => ['Week 1', 'Week 2'],
  getWeekDates: () => [{ value: '2025-01-10', label: '금 (1/10)' }],
}));

jest.mock('@/lib/schemas/problem', () => ({
  problemCreateSchema: {
    parse: jest.fn(),
  },
}));

jest.mock('@hookform/resolvers/zod', () => ({
  zodResolver: () => jest.fn(),
}));

jest.mock('@/lib/avatars', () => ({
  getAvatarSrc: () => '/avatar.png',
}));

jest.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return {
    CheckCircle2: Icon,
    Search: Icon,
    ExternalLink: Icon,
    Plus: Icon,
    FileText: Icon,
    Clock: Icon,
    X: Icon,
  };
});

describe('ProblemCreatePage', () => {
  it('ADMIN 사용자에게 문제 생성 폼이 렌더링된다', () => {
    renderWithI18n(<ProblemCreatePage />);
    expect(screen.getByText('문제 추가')).toBeInTheDocument();
  });

  it('AppLayout 안에 렌더링된다', () => {
    renderWithI18n(<ProblemCreatePage />);
    expect(screen.getByTestId('app-layout')).toBeInTheDocument();
  });

  it('프로그래머스 문제 검색 섹션이 기본 표시된다', () => {
    renderWithI18n(<ProblemCreatePage />);
    expect(screen.getByText('프로그래머스 문제 검색')).toBeInTheDocument();
  });

  it('기본 정보 섹션이 표시된다', () => {
    renderWithI18n(<ProblemCreatePage />);
    expect(screen.getByText('기본 정보')).toBeInTheDocument();
  });

  it('문제 생성 버튼이 표시된다', () => {
    renderWithI18n(<ProblemCreatePage />);
    expect(screen.getByText('문제 생성')).toBeInTheDocument();
  });

  it('뒤로가기 버튼이 표시된다', () => {
    renderWithI18n(<ProblemCreatePage />);
    expect(screen.getByText('문제 목록')).toBeInTheDocument();
  });
});

describe('ProblemCreatePage - Non-ADMIN', () => {
  it('ADMIN이 아니면 권한 없음 메시지가 표시된다', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const studyContext = require('@/contexts/StudyContext');
    const originalUseStudy = studyContext.useStudy;
    studyContext.useStudy = () => ({
      currentStudyId: 'study-1',
      currentStudyName: 'Test Study',
      currentStudyRole: 'MEMBER',
      studies: [{ id: 'study-1', name: 'Test Study' }],
      setCurrentStudy: jest.fn(),
      studiesLoaded: true,
    });

    renderWithI18n(<ProblemCreatePage />);
    expect(screen.getByText('문제 생성은 관리자만 가능합니다.')).toBeInTheDocument();

    studyContext.useStudy = originalUseStudy;
  });
});
