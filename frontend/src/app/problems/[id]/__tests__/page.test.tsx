import { render, screen, act } from '@testing-library/react';
import { Suspense } from 'react';
import ProblemDetailPage from '../page';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  usePathname: () => '/problems/test-id',
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
    githubConnected: true,
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

jest.mock('@/hooks/useAutoSave', () => ({
  useAutoSave: () => ({
    loadFromLocal: jest.fn().mockReturnValue(null),
    clearLocal: jest.fn(),
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
  CardTitle: ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/ui/Badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span data-testid="badge">{children}</span>,
}));

jest.mock('@/components/ui/DifficultyBadge', () => ({
  DifficultyBadge: () => <span data-testid="difficulty-badge" />,
}));

jest.mock('@/components/ui/TimerBadge', () => ({
  TimerBadge: () => <span data-testid="timer-badge" />,
}));

jest.mock('@/components/ui/LangBadge', () => ({
  LangBadge: () => <span data-testid="lang-badge" />,
}));

jest.mock('@/components/ui/Alert', () => ({
  Alert: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="alert">{children}</div>
  ),
}));

jest.mock('@/components/ui/Button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

jest.mock('@/components/ui/Skeleton', () => ({
  Skeleton: () => <div data-testid="skeleton" />,
}));

jest.mock('@/components/submission/CodeEditor', () => ({
  CodeEditor: () => <div data-testid="code-editor" />,
}));

jest.mock('@/lib/api', () => ({
  problemApi: {
    findById: jest.fn().mockResolvedValue({
      id: 'test-id',
      title: 'Two Sum',
      description: '두 수의 합',
      difficulty: 'EASY',
      weekNumber: '3월1주차',
      status: 'ACTIVE',
      tags: ['배열'],
      allowedLanguages: ['python'],
      deadline: null,
      sourceUrl: null,
    }),
    delete: jest.fn(),
  },
  submissionApi: { create: jest.fn() },
  draftApi: {
    find: jest.fn().mockRejectedValue(new Error('no draft')),
    upsert: jest.fn(),
    remove: jest.fn(),
  },
}));

jest.mock('@/lib/avatars', () => ({
  getAvatarSrc: () => '/avatar.png',
}));

jest.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return {
    ChevronLeft: Icon,
    Pencil: Icon,
    Trash2: Icon,
    ExternalLink: Icon,
  };
});

describe('ProblemDetailPage', () => {
  const renderPage = async () => {
    const paramsPromise = Promise.resolve({ id: 'test-id' });
    await act(async () => {
      render(
        <Suspense fallback={<div>loading</div>}>
          <ProblemDetailPage params={paramsPromise} />
        </Suspense>,
      );
    });
  };

  it('문제 상세 페이지가 렌더링된다', async () => {
    await renderPage();
    expect(await screen.findByText('Two Sum')).toBeInTheDocument();
  });

  it('AppLayout 안에 렌더링된다', async () => {
    await renderPage();
    await screen.findByText('Two Sum');
    expect(screen.getByTestId('app-layout')).toBeInTheDocument();
  });

  it('문제 목록 버튼이 표시된다', async () => {
    await renderPage();
    await screen.findByText('Two Sum');
    expect(screen.getByText('문제 목록')).toBeInTheDocument();
  });

  it('관리자에게 수정/삭제 버튼이 표시된다', async () => {
    await renderPage();
    await screen.findByText('Two Sum');
    expect(screen.getByText('수정')).toBeInTheDocument();
    expect(screen.getByText('삭제')).toBeInTheDocument();
  });
});
