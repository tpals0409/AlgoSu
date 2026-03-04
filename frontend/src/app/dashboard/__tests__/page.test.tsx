import { render, screen } from '@testing-library/react';
import DashboardPage from '../page';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  usePathname: () => '/dashboard',
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

jest.mock('@/hooks/useAnimVal', () => ({
  useAnimVal: () => [{ current: null }, 0],
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

jest.mock('@/components/ui/LoadingSpinner', () => ({
  LoadingSpinner: () => <div data-testid="loading-spinner" />,
}));

jest.mock('@/lib/api', () => ({
  studyApi: { getStats: jest.fn().mockResolvedValue(null), getMembers: jest.fn().mockResolvedValue([]) },
  submissionApi: { list: jest.fn().mockResolvedValue({ data: [], meta: {} }) },
  problemApi: { findAll: jest.fn().mockResolvedValue([]), findAllIncludingClosed: jest.fn().mockResolvedValue([]) },
}));

jest.mock('@/lib/utils', () => ({
  cn: (...args: string[]) => args.filter(Boolean).join(' '),
  getCurrentWeekLabel: () => '3월1주차',
}));

jest.mock('@/lib/avatars', () => ({
  getAvatarSrc: () => '/avatar.png',
}));

jest.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return {
    FileText: Icon,
    Users: Icon,
    CheckCircle2: Icon,
    RefreshCw: Icon,
    Github: Icon,
  };
});

// next/dynamic mock - 동적 import된 컴포넌트를 빈 div로 대체
jest.mock('next/dynamic', () => () => {
  const DynamicComponent = () => <div data-testid="dynamic-component" />;
  DynamicComponent.displayName = 'DynamicComponent';
  return DynamicComponent;
});

describe('DashboardPage', () => {
  it('대시보드 페이지가 렌더링된다', () => {
    render(<DashboardPage />);
    expect(screen.getByText('대시보드')).toBeInTheDocument();
  });

  it('AppLayout 안에 렌더링된다', () => {
    render(<DashboardPage />);
    expect(screen.getByTestId('app-layout')).toBeInTheDocument();
  });

  it('새로고침 버튼이 표시된다', () => {
    render(<DashboardPage />);
    expect(screen.getByText('새로고침')).toBeInTheDocument();
  });
});
