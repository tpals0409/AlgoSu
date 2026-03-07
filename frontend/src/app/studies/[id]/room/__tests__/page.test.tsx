import { render, screen } from '@testing-library/react';
import StudyRoomPage from '../page';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useParams: () => ({ id: 'study-1' }),
  usePathname: () => '/studies/study-1/room',
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

jest.mock('@/components/ui/DiffBadge', () => ({
  DiffBadge: () => <span data-testid="diff-badge" />,
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
}));

jest.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return {
    Code2: Icon,
    Users: Icon,
    ChevronRight: Icon,
    Clock: Icon,
    AlertCircle: Icon,
  };
});

describe('StudyRoomPage', () => {
  it('코드 리뷰 타이틀이 렌더링된다', async () => {
    render(<StudyRoomPage />);
    expect(await screen.findByText('코드 리뷰')).toBeInTheDocument();
  });

  it('AppLayout 안에 렌더링된다', () => {
    render(<StudyRoomPage />);
    expect(screen.getByTestId('app-layout')).toBeInTheDocument();
  });

  it('안내 배너가 표시된다', () => {
    render(<StudyRoomPage />);
    expect(screen.getByText(/마감 전 코드는 본인만 볼 수 있으며/)).toBeInTheDocument();
  });

  it('문제가 없으면 빈 상태가 표시된다', async () => {
    render(<StudyRoomPage />);
    expect(await screen.findByText('등록된 문제가 없습니다')).toBeInTheDocument();
  });
});

describe('StudyRoomPage - with problems', () => {
  it('문제 목록이 표시된다', async () => {
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
  });
});
