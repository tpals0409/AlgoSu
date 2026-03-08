import { render, screen } from '@testing-library/react';
import ProblemsPage from '../page';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  usePathname: () => '/problems',
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
}));

jest.mock('@/components/ui/Badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span data-testid="badge">{children}</span>,
}));

jest.mock('@/components/ui/Button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

jest.mock('@/components/ui/DifficultyBadge', () => ({
  DifficultyBadge: () => <span data-testid="difficulty-badge" />,
}));

jest.mock('@/components/ui/TimerBadge', () => ({
  TimerBadge: () => <span data-testid="timer-badge" />,
}));

jest.mock('@/components/ui/Alert', () => ({
  Alert: ({ children }: { children: React.ReactNode }) => <div data-testid="alert">{children}</div>,
}));

jest.mock('@/components/ui/EmptyState', () => ({
  EmptyState: ({ title }: { title: string }) => <div data-testid="empty-state">{title}</div>,
}));

jest.mock('@/components/ui/Skeleton', () => ({
  SkeletonTable: () => <div data-testid="skeleton-table" />,
}));

jest.mock('@/lib/api', () => ({
  problemApi: {
    findAll: jest.fn().mockResolvedValue([]),
  },
  studyApi: {
    getStats: jest.fn().mockResolvedValue(null),
  },
}));

jest.mock('@/lib/constants', () => ({
  DIFFICULTIES: ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND'],
  DIFFICULTY_LABELS: {
    BRONZE: 'Bronze',
    SILVER: 'Silver',
    GOLD: 'Gold',
    PLATINUM: 'Platinum',
    DIAMOND: 'Diamond',
  },
  toTierLevel: (rawLevel: number | null | undefined) => {
    if (rawLevel == null || rawLevel <= 0) return null;
    if (rawLevel >= 1 && rawLevel <= 5) return rawLevel;
    return 5 - ((rawLevel - 1) % 5);
  },
  PROBLEM_STATUSES: ['ACTIVE', 'CLOSED'],
  PROBLEM_STATUS_LABELS: { ACTIVE: '진행 중', CLOSED: '종료' },
}));

jest.mock('@/components/ui/AddProblemModal', () => ({
  AddProblemModal: () => <div data-testid="add-problem-modal" />,
}));

jest.mock('@/lib/avatars', () => ({
  getAvatarSrc: () => '/avatar.png',
}));

jest.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return {
    BookOpen: Icon,
    Plus: Icon,
    Search: Icon,
    Check: Icon,
    ChevronLeft: Icon,
    ChevronRight: Icon,
  };
});

describe('ProblemsPage', () => {
  it('문제 목록 페이지가 렌더링된다', async () => {
    render(<ProblemsPage />);
    expect(await screen.findByText('문제 목록')).toBeInTheDocument();
  });

  it('AppLayout 안에 렌더링된다', () => {
    render(<ProblemsPage />);
    expect(screen.getByTestId('app-layout')).toBeInTheDocument();
  });

  it('문제 추가 버튼이 관리자에게 표시된다', () => {
    render(<ProblemsPage />);
    expect(screen.getByText('문제 추가')).toBeInTheDocument();
  });
});
