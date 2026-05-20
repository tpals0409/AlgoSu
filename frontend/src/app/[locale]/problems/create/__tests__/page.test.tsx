import { screen, fireEvent, act, waitFor } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/i18n';
import ProblemCreatePage from '../page';
import { problemApi } from '@/lib/api';

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
    incrementProblemsVersion: jest.fn(),
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
  PROBLEM_CATEGORIES: ['ALGORITHM', 'SQL'],
}));

jest.mock('@/lib/problem-form-utils', () => ({
  labelClass: 'label-class',
  selectClass: 'select-class',
  textareaClass: 'textarea-class',
}));

jest.mock('@/lib/schemas/problem', () => ({
  problemCreateSchema: {
    parse: jest.fn(),
  },
}));

jest.mock('@hookform/resolvers/zod', () => ({
  // RHF resolver 계약 준수: { values, errors } 반환 (검증 통과 → onSubmit 진입)
  zodResolver: () => (values: Record<string, unknown>) => ({ values, errors: {} }),
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

  it('카테고리 select와 옵션(알고리즘/SQL)이 기본 ALGORITHM으로 표시된다', () => {
    renderWithI18n(<ProblemCreatePage />);
    const categorySelect = screen.getByLabelText('카테고리') as HTMLSelectElement;
    expect(categorySelect).toBeInTheDocument();
    expect(categorySelect.value).toBe('ALGORITHM');
    expect(screen.getByRole('option', { name: '알고리즘' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'SQL' })).toBeInTheDocument();
  });

  it('검색 미적용 시 카테고리 select가 활성화되어 있다', () => {
    renderWithI18n(<ProblemCreatePage />);
    const categorySelect = screen.getByLabelText('카테고리') as HTMLSelectElement;
    expect(categorySelect).not.toBeDisabled();
  });
});

describe('ProblemCreatePage - Programmers 검색 적용 (category 전파)', () => {
  // page가 useProgrammersSearch(setFormAndSync, ...)로 넘기는 setForm을 캡처한다.
  let capturedSetForm: ((updater: unknown) => void) | null = null;

  beforeEach(() => {
    (problemApi.create as jest.Mock).mockClear();
    capturedSetForm = null;
  });

  /**
   * page의 setFormAndSync에 직접 접근할 수 없으므로, useProgrammersSearch mock이
   * 첫 인자(setForm)를 캡처하도록 한 뒤 검색 결과를 시뮬레이션한다.
   */
  function overrideProgrammersHook(category: 'ALGORITHM' | 'SQL') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const programmersHook = require('@/hooks/useProgrammersSearch');
    const original = programmersHook.useProgrammersSearch;
    programmersHook.useProgrammersSearch = (setForm: (u: unknown) => void) => {
      capturedSetForm = setForm;
      return {
        programmersQuery: '',
        setProgrammersQuery: jest.fn(),
        programmersSearching: false,
        programmersError: null,
        setProgrammersError: jest.fn(),
        programmersResult: {
          problemId: 12117,
          title: '검색된 문제',
          difficulty: 'SILVER',
          level: 2,
          sourceUrl: 'https://school.programmers.co.kr/learn/courses/30/lessons/12117',
          tags: [],
          category: category === 'SQL' ? 'sql' : 'algorithm',
        },
        programmersApplied: true,
        handleProgrammersSearch: jest.fn(),
        handleProgrammersKeyDown: jest.fn(),
        handleProgrammersReset: jest.fn(),
      };
    };
    return () => { programmersHook.useProgrammersSearch = original; };
  }

  it('프로그래머스 검색 적용 시 카테고리 select는 편집 가능(enabled)하다', () => {
    const restore = overrideProgrammersHook('SQL');
    renderWithI18n(<ProblemCreatePage />);
    const categorySelect = screen.getByLabelText('카테고리') as HTMLSelectElement;
    expect(categorySelect).not.toBeDisabled();
    restore();
  });

  it('P1: SQL 검색 적용 후 제출 시 category=SQL 포함해 create가 호출된다', async () => {
    const restore = overrideProgrammersHook('SQL');
    renderWithI18n(<ProblemCreatePage />);

    // 검색 결과가 setForm(setFormAndSync)으로 category=SQL을 RHF에 전파하도록 시뮬레이션
    act(() => {
      capturedSetForm?.((prev: Record<string, unknown>) => ({
        ...prev,
        title: '검색된 문제',
        difficulty: 'SILVER',
        category: 'SQL',
        sourceUrl: 'https://school.programmers.co.kr/learn/courses/30/lessons/12117',
        sourcePlatform: 'PROGRAMMERS',
      }));
    });

    const categorySelect = screen.getByLabelText('카테고리') as HTMLSelectElement;
    expect(categorySelect.value).toBe('SQL');

    fireEvent.click(screen.getByText('문제 생성'));

    await waitFor(() => {
      expect(problemApi.create as jest.Mock).toHaveBeenCalled();
    });
    const arg = (problemApi.create as jest.Mock).mock.calls[0][0];
    expect(arg.category).toBe('SQL');
    restore();
  });

  it('P2: 수동 SQL 선택 후 algorithm 검색 적용 시 최종 category=ALGORITHM (stale 방지)', async () => {
    const restore = overrideProgrammersHook('ALGORITHM');
    renderWithI18n(<ProblemCreatePage />);

    const categorySelect = screen.getByLabelText('카테고리') as HTMLSelectElement;

    // 1) 검색 전 수동으로 SQL 선택 → RHF=SQL, 프록시는 초기 ALGORITHM 유지
    fireEvent.change(categorySelect, { target: { value: 'SQL' } });
    expect(categorySelect.value).toBe('SQL');

    // 2) algorithm Programmers 검색 적용 → setFormAndSync가 무조건 ALGORITHM 동기화
    act(() => {
      capturedSetForm?.((prev: Record<string, unknown>) => ({
        ...prev,
        title: '검색된 문제',
        difficulty: 'SILVER',
        category: 'ALGORITHM',
        sourceUrl: 'https://school.programmers.co.kr/learn/courses/30/lessons/12117',
        sourcePlatform: 'PROGRAMMERS',
      }));
    });

    expect(categorySelect.value).toBe('ALGORITHM');

    fireEvent.click(screen.getByText('문제 생성'));
    await waitFor(() => {
      expect(problemApi.create as jest.Mock).toHaveBeenCalled();
    });
    const arg = (problemApi.create as jest.Mock).mock.calls[0][0];
    expect(arg.category).toBe('ALGORITHM');
    restore();
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
