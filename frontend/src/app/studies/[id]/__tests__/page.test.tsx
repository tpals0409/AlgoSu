import { render, screen, act } from '@testing-library/react';
import { Suspense } from 'react';
import StudyDetailPage from '../page';

jest.mock('@/components/ui/MarkdownViewer', () => ({
  MarkdownViewer: ({ content }: { content: string }) => <div data-testid="markdown-viewer">{content}</div>,
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  usePathname: () => '/studies/study-1',
}));

jest.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'light', setTheme: jest.fn() }),
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    user: { email: 'admin@example.com', avatarPreset: 'default' },
    logout: jest.fn(),
  }),
}));

jest.mock('@/contexts/StudyContext', () => ({
  useStudy: () => ({
    currentStudyId: 'study-1',
    currentStudyName: 'Test Study',
    studies: [{ id: 'study-1', name: 'Test Study' }],
    setCurrentStudy: jest.fn(),
    studiesLoaded: true,
    removeStudy: jest.fn(),
  }),
}));

jest.mock('@/hooks/useRequireAuth', () => ({
  useRequireAuth: () => ({ isReady: true, isAuthenticated: true }),
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
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>{children}</div>
  ),
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/ui/Badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span data-testid="badge">{children}</span>,
}));

jest.mock('@/components/ui/DifficultyBadge', () => ({
  DifficultyBadge: () => <span data-testid="difficulty-badge" />,
}));

jest.mock('@/components/ui/Button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

jest.mock('@/components/ui/Input', () => {
  const { forwardRef } = jest.requireActual<typeof import('react')>('react');
  return {
    Input: forwardRef<HTMLInputElement, { label?: string; error?: string }>(
      function MockInput({ label, error, ...props }, ref) {
        return (
          <div>
            {label && <label>{label}</label>}
            <input ref={ref} {...props} />
            {error && <span>{error}</span>}
          </div>
        );
      },
    ),
  };
});

jest.mock('@/components/ui/Alert', () => ({
  Alert: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="alert">{children}</div>
  ),
}));

jest.mock('@/components/ui/LoadingSpinner', () => ({
  LoadingSpinner: () => <div data-testid="loading-spinner" />,
  InlineSpinner: () => <span data-testid="inline-spinner" />,
}));

jest.mock('@/components/ui/Skeleton', () => ({
  Skeleton: () => <div data-testid="skeleton" />,
}));

jest.mock('@/lib/api', () => ({
  studyApi: {
    getById: jest.fn().mockResolvedValue({
      id: 'study-1',
      name: 'Test Study',
      description: 'A test study',
      githubRepo: null,
      role: 'ADMIN',
    }),
    getMembers: jest.fn().mockResolvedValue([
      {
        id: 'member-1',
        user_id: 'user-1',
        email: 'admin@example.com',
        nickname: 'Admin',
        username: 'admin',
        role: 'ADMIN',
        joined_at: '2025-01-01',
        avatar_url: null,
        deleted_at: null,
      },
    ]),
    getStats: jest.fn().mockResolvedValue({
      totalSubmissions: 5,
      solvedProblemIds: ['p1'],
      byWeek: [{ week: '3월1주차', count: 3 }],
      byMember: [{ userId: 'user-1', count: 3, doneCount: 2 }],
      recentSubmissions: [],
    }),
    invite: jest.fn(),
    removeMember: jest.fn(),
    changeRole: jest.fn(),
    updateNickname: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  problemApi: {
    findAll: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('@/lib/avatars', () => ({
  getAvatarSrc: () => '/avatar.png',
  getAvatarPresetKey: () => 'default',
}));

jest.mock('@/lib/utils', () => ({
  cn: (...args: string[]) => args.filter(Boolean).join(' '),
}));

jest.mock('react-dom', () => ({
  ...jest.requireActual<typeof import('react-dom')>('react-dom'),
  createPortal: (node: React.ReactNode) => node,
}));

jest.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return {
    ArrowLeft: Icon,
    Shield: Icon,
    BookOpen: Icon,
    Users: Icon,
    Settings: Icon,
    Crown: Icon,
    Pencil: Icon,
    Check: Icon,
    X: Icon,
  };
});

describe('StudyDetailPage', () => {
  const renderPage = async () => {
    const paramsPromise = Promise.resolve({ id: 'study-1' });
    await act(async () => {
      render(
        <Suspense fallback={<div>loading</div>}>
          <StudyDetailPage params={paramsPromise} />
        </Suspense>,
      );
    });
  };

  it('스터디 상세 페이지가 렌더링된다', async () => {
    await renderPage();
    const elements = await screen.findAllByText('Test Study');
    expect(elements.length).toBeGreaterThanOrEqual(1);
  });

  it('AppLayout 안에 렌더링된다', async () => {
    await renderPage();
    await screen.findAllByText('Test Study');
    expect(screen.getByTestId('app-layout')).toBeInTheDocument();
  });

  it('탭 버튼들이 표시된다', async () => {
    await renderPage();
    await screen.findAllByText('Test Study');
    expect(screen.getAllByText('그라운드룰').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('문제').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('멤버').length).toBeGreaterThanOrEqual(1);
  });
});
