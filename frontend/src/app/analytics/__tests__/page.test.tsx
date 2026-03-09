import { render, screen } from '@testing-library/react';
import AnalyticsPage from '../page';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  usePathname: () => '/analytics',
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

jest.mock('@/components/ui/Skeleton', () => ({
  Skeleton: () => <div data-testid="skeleton" />,
}));

jest.mock('@/components/ui/LoadingSpinner', () => ({
  LoadingSpinner: () => <div data-testid="loading-spinner" />,
}));

jest.mock('@/components/ui/Button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

jest.mock('next/dynamic', () => () => {
  const DynamicComponent = () => <div data-testid="dynamic-component" />;
  DynamicComponent.displayName = 'DynamicComponent';
  return DynamicComponent;
});

jest.mock('@/lib/api', () => ({
  studyApi: { getStats: jest.fn().mockResolvedValue({ totalSubmissions: 0, byMember: [], byWeek: [], byWeekPerUser: [], solvedProblemIds: [] }), getMembers: jest.fn().mockResolvedValue([]) },
  problemApi: { findAllProblems: jest.fn().mockResolvedValue([]) },
}));

jest.mock('@/lib/utils', () => ({
  cn: (...args: string[]) => args.filter(Boolean).join(' '),
  getCurrentWeekLabel: () => '3월1주차',
}));

jest.mock('@/lib/auth', () => ({
  getCurrentUserId: () => 'user-1',
}));

jest.mock('@/lib/avatars', () => ({
  getAvatarSrc: () => '/avatar.png',
}));

jest.mock('next/link', () => {
  const MockLink = ({ children, ...props }: { children: React.ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
});

jest.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return {
    ArrowLeft: Icon,
    RefreshCw: Icon,
    BarChart3: Icon,
  };
});

describe('AnalyticsPage', () => {
  it('통계 페이지가 렌더링된다', async () => {
    render(<AnalyticsPage />);
    expect(await screen.findByText('내 통계')).toBeInTheDocument();
  });

  it('AppLayout 안에 렌더링된다', () => {
    render(<AnalyticsPage />);
    expect(screen.getByTestId('app-layout')).toBeInTheDocument();
  });

  it('사용자 학습 현황 메시지가 표시된다', async () => {
    render(<AnalyticsPage />);
    expect(await screen.findByText(/알고리즘 학습 현황/)).toBeInTheDocument();
  });
});
