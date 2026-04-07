import { render, screen } from '@testing-library/react';
import StudyRoomPage from '../page';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useParams: () => ({ id: 'study-1' }),
  usePathname: () => '/studies/study-1/room',
  useSearchParams: () => new URLSearchParams(),
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
    currentStudyRole: 'MEMBER',
    studies: [{ id: 'study-1', name: 'Test Study' }],
    setCurrentStudy: jest.fn(),
    studiesLoaded: true,
  }),
}));

jest.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-layout">{children}</div>
  ),
}));

jest.mock('@/components/ui/DifficultyBadge', () => ({
  DifficultyBadge: () => <span data-testid="difficulty-badge" />,
}));

jest.mock('@/components/ui/StatusBadge', () => ({
  StatusBadge: ({ label }: { label: string }) => <span data-testid="status-badge">{label}</span>,
}));

jest.mock('@/components/ui/LangBadge', () => ({
  LangBadge: () => <span data-testid="lang-badge" />,
}));

jest.mock('@/components/ui/Skeleton', () => ({
  Skeleton: () => <div data-testid="skeleton" />,
  SkeletonCard: () => <div data-testid="skeleton-card" />,
}));

jest.mock('@/components/review/StudyNoteEditor', () => ({
  StudyNoteEditor: () => <div data-testid="study-note-editor" />,
}));

jest.mock('@/components/ui/CodeBlock', () => ({
  CodeBlock: () => <div data-testid="code-block" />,
}));

jest.mock('@/components/ui/ScoreGauge', () => ({
  ScoreGauge: () => <div data-testid="score-gauge" />,
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    user: { email: 'test@example.com', avatarPreset: 'default' },
    logout: jest.fn(),
  }),
}));

jest.mock('@/lib/api', () => ({
  problemApi: {
    findAll: jest.fn().mockResolvedValue([]),
  },
  submissionApi: {
    list: jest.fn().mockResolvedValue({ data: [], meta: {} }),
    listByProblemForStudy: jest.fn().mockResolvedValue([]),
  },
  studyApi: {
    getMembers: jest.fn().mockResolvedValue([]),
    getStats: jest.fn().mockResolvedValue({
      totalSubmissions: 0,
      byWeek: [],
      byWeekPerUser: [],
      byMember: [],
      byMemberWeek: null,
      recentSubmissions: [],
      solvedProblemIds: [],
      submitterCountByProblem: [],
    }),
  },
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

jest.mock('@/lib/utils', () => ({
  cn: (...args: (string | boolean | undefined)[]) => args.filter(Boolean).join(' '),
}));

jest.mock('@/lib/avatars', () => ({
  getAvatarSrc: () => '/avatar.png',
  getAvatarPresetKey: () => 'default',
}));

jest.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return {
    BookOpen: Icon,
    Users: Icon,
    Sparkles: Icon,
    Code2: Icon,
    ChevronRight: Icon,
    ChevronDown: Icon,
    AlertCircle: Icon,
    CheckCircle2: Icon,
    ArrowLeft: Icon,
    Copy: Icon,
    Check: Icon,
    Brain: Icon,
    BarChart3: Icon,
    ExternalLink: Icon,
  };
});

describe('StudyRoomPage', () => {
  it('스터디룸 타이틀이 렌더링된다', async () => {
    render(<StudyRoomPage />);
    expect(await screen.findByText('스터디룸')).toBeInTheDocument();
  });

  it('AppLayout 안에 렌더링된다', () => {
    render(<StudyRoomPage />);
    expect(screen.getByTestId('app-layout')).toBeInTheDocument();
  });

  it('안내 텍스트가 표시된다', () => {
    render(<StudyRoomPage />);
    expect(screen.getByText('문제를 선택해 멤버별 제출 코드를 확인하세요.')).toBeInTheDocument();
  });

  it('문제가 없으면 빈 상태가 표시된다', async () => {
    render(<StudyRoomPage />);
    expect(await screen.findByText('등록된 문제가 없습니다')).toBeInTheDocument();
  });
});

describe('StudyRoomPage - with problems', () => {
  it('문제 목록이 주차별로 표시된다', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { problemApi } = require('@/lib/api');
    problemApi.findAll.mockResolvedValue([
      {
        id: 'p-1',
        title: 'Two Sum',
        difficulty: 'GOLD',
        level: 11,
        weekNumber: '1월1주차',
        deadline: '2020-01-01T00:00:00.000Z',
        status: 'CLOSED',
      },
    ]);

    render(<StudyRoomPage />);
    expect(await screen.findByText('Two Sum')).toBeInTheDocument();
    expect(screen.getByText('1월1주차')).toBeInTheDocument();
  });
});
