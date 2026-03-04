import { render, screen } from '@testing-library/react';
import ProfilePage from '../page';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  usePathname: () => '/profile',
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
    githubConnected: false,
    updateGitHubStatus: jest.fn(),
    updateAvatar: jest.fn(),
  }),
}));

jest.mock('@/contexts/StudyContext', () => ({
  useStudy: () => ({
    currentStudyId: 'study-1',
    studies: [{ id: 'study-1', name: 'Test Study' }],
    setCurrentStudy: jest.fn(),
    studiesLoaded: true,
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
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/ui/Badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span data-testid="badge">{children}</span>,
}));

jest.mock('@/components/ui/Button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

jest.mock('@/components/ui/Alert', () => ({
  Alert: ({ children }: { children: React.ReactNode }) => <div data-testid="alert">{children}</div>,
}));

jest.mock('@/components/ui/Skeleton', () => ({
  Skeleton: () => <div data-testid="skeleton" />,
}));

jest.mock('@/components/ui/LoadingSpinner', () => ({
  InlineSpinner: () => <span data-testid="inline-spinner" />,
}));

jest.mock('@/lib/api', () => ({
  authApi: {
    getProfile: jest.fn().mockResolvedValue({ name: 'Test User', oauth_provider: 'GOOGLE' }),
    linkGitHub: jest.fn(),
    unlinkGitHub: jest.fn(),
    relinkGitHub: jest.fn(),
    deleteAccount: jest.fn(),
  },
  submissionApi: {
    list: jest.fn().mockResolvedValue({ data: [], meta: { total: 5 } }),
  },
}));

jest.mock('@/lib/auth', () => ({
  getGitHubUsername: () => null,
}));

jest.mock('@/lib/avatars', () => ({
  getAvatarSrc: () => '/avatar.png',
  AVATAR_PRESETS: [{ key: 'default', label: '기본' }],
}));

jest.mock('@/lib/utils', () => ({
  cn: (...args: string[]) => args.filter(Boolean).join(' '),
}));

jest.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return {
    User: Icon,
    Github: Icon,
    LogOut: Icon,
    RefreshCw: Icon,
    Link2: Icon,
    Unlink: Icon,
    FileText: Icon,
    CheckCircle2: Icon,
    Trash2: Icon,
  };
});

describe('ProfilePage', () => {
  it('프로필 페이지가 렌더링된다', () => {
    render(<ProfilePage />);
    expect(screen.getByText('프로필')).toBeInTheDocument();
  });

  it('AppLayout 안에 렌더링된다', () => {
    render(<ProfilePage />);
    expect(screen.getByTestId('app-layout')).toBeInTheDocument();
  });

  it('계정 정보 섹션이 표시된다', () => {
    render(<ProfilePage />);
    expect(screen.getByText('계정 정보 및 연동 설정')).toBeInTheDocument();
  });

  it('GitHub 연동 섹션이 표시된다', () => {
    render(<ProfilePage />);
    const elements = screen.getAllByText('GitHub 연동');
    expect(elements.length).toBeGreaterThanOrEqual(1);
  });

  it('소속 스터디 섹션이 표시된다', () => {
    render(<ProfilePage />);
    expect(screen.getByText('소속 스터디')).toBeInTheDocument();
  });

  it('로그아웃 버튼이 표시된다', () => {
    render(<ProfilePage />);
    expect(screen.getByText('로그아웃')).toBeInTheDocument();
  });

  it('계정 삭제 섹션이 표시된다', () => {
    render(<ProfilePage />);
    const elements = screen.getAllByText('계정 삭제');
    expect(elements.length).toBeGreaterThanOrEqual(1);
  });
});
