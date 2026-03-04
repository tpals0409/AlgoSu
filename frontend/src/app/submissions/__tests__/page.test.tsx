import { render, screen } from '@testing-library/react';
import SubmissionsPage from '../page';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  usePathname: () => '/submissions',
}));

jest.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'light', setTheme: jest.fn() }),
}));

jest.mock('next/link', () => {
  return ({ children, ...props }: { children: React.ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  );
});

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

jest.mock('@/components/ui/Badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span data-testid="badge">{children}</span>,
}));

jest.mock('@/components/ui/Button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

jest.mock('@/components/ui/Alert', () => ({
  Alert: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="alert">{children}</div>
  ),
}));

jest.mock('@/components/ui/EmptyState', () => ({
  EmptyState: ({ title }: { title: string }) => <div data-testid="empty-state">{title}</div>,
}));

jest.mock('@/components/ui/LangBadge', () => ({
  LangBadge: () => <span data-testid="lang-badge" />,
}));

jest.mock('@/components/ui/DifficultyBadge', () => ({
  DifficultyBadge: () => <span data-testid="difficulty-badge" />,
}));

jest.mock('@/components/ui/Skeleton', () => ({
  SkeletonTable: () => <div data-testid="skeleton-table" />,
}));

jest.mock('@/components/ui/LoadingSpinner', () => ({
  LoadingSpinner: () => <div data-testid="loading-spinner" />,
}));

jest.mock('@/lib/api', () => ({
  submissionApi: {
    list: jest.fn().mockResolvedValue({ data: [], meta: { total: 0, totalPages: 1 } }),
  },
  problemApi: {
    findAllIncludingClosed: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('@/lib/constants', () => ({
  SAGA_STEP_CONFIG: {
    INIT: { label: '초기화', variant: 'muted' },
    GITHUB_PUSH: { label: 'GitHub Push', variant: 'info' },
    AI_ANALYSIS: { label: 'AI 분석', variant: 'info' },
    DONE: { label: '완료', variant: 'success' },
    FAILED: { label: '실패', variant: 'error' },
  },
  LANGUAGE_VALUES: ['python', 'javascript', 'java', 'cpp'],
}));

jest.mock('@/lib/avatars', () => ({
  getAvatarSrc: () => '/avatar.png',
}));

jest.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return {
    FileText: Icon,
    ChevronLeft: Icon,
    ChevronRight: Icon,
    Filter: Icon,
    X: Icon,
    Search: Icon,
  };
});

describe('SubmissionsPage', () => {
  it('제출 목록 페이지가 렌더링된다', async () => {
    render(<SubmissionsPage />);
    expect(await screen.findByText('Test Study · 제출 이력')).toBeInTheDocument();
  });

  it('AppLayout 안에 렌더링된다', () => {
    render(<SubmissionsPage />);
    expect(screen.getByTestId('app-layout')).toBeInTheDocument();
  });

  it('필터 버튼이 표시된다', () => {
    render(<SubmissionsPage />);
    expect(screen.getByText('필터')).toBeInTheDocument();
  });
});
