import { render, screen } from '@testing-library/react';
import ProblemsPage from '../page';

jest.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  usePathname: () => '/problems',
  Link: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { children: React.ReactNode }) => <a {...props}>{children}</a>,
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  usePathname: () => '/problems',
}));

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, string>) => {
    const map: Record<string, string> = {
      'list.heading': '문제 목록',
      'list.subheading': '스터디 문제를 확인하고 코드를 제출하세요.',
      'list.searchPlaceholder': '문제 검색...',
      'list.filter.statusPlaceholder': '상태 선택',
      'list.filter.all': '전체',
      'list.filter.inProgress': '진행 중',
      'list.filter.finished': '종료',
      'list.difficultyAll': '전체',
      'list.empty.title': '등록된 문제가 없습니다',
      'list.empty.description': '곧 새로운 문제가 추가될 예정입니다.',
      'list.noResults.title': '검색 결과가 없습니다',
      'list.noResults.description': '필터 조건을 변경해 보세요.',
      'list.noResults.resetFilter': '필터 초기화',
      'list.badge.inProgress': '진행 중',
      'list.badge.finished': '종료',
      'list.badge.deadline': '마감',
      'list.addProblem': '문제 추가',
    };
    if (params && map[key]) return map[key];
    return map[key] ?? key;
  },
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

jest.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode; value?: string; onValueChange?: (v: string) => void }) => <div data-testid="select">{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <button data-testid="select-trigger">{children}</button>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => <div data-value={value}>{children}</div>,
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
  DIFF_DOT_STYLE: {},
  DIFF_BADGE_STYLE: {},
  toTierLevel: (rawLevel: number | null | undefined) => {
    if (rawLevel == null || rawLevel <= 0) return null;
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
