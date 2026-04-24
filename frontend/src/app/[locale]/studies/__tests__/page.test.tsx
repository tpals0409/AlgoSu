import { screen, fireEvent } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/i18n';
import StudiesPage from '../page';

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn() }),
  usePathname: () => '/studies',
  Link: () => null,
  redirect: jest.fn(),
}));
jest.mock('next/navigation', () => ({
  useParams: () => ({ locale: 'ko' }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/studies',
}));

jest.mock('next/link', () => {
  return {
    __esModule: true,
    default: ({ children, href }: { children: React.ReactNode; href: string }) => (
      <a href={href}>{children}</a>
    ),
  };
});

jest.mock('@/hooks/useRequireAuth', () => ({
  useRequireAuth: () => ({ isReady: true, isAuthenticated: true }),
}));

jest.mock('@/contexts/StudyContext', () => ({
  useStudy: () => ({
    setCurrentStudy: jest.fn(),
    setStudies: jest.fn(),
  }),
}));

jest.mock('@/lib/api', () => ({
  studyApi: {
    list: jest.fn().mockResolvedValue([]),
    verifyInvite: jest.fn(),
    join: jest.fn(),
    create: jest.fn(),
  },
  ApiError: class ApiError extends Error {},
}));

jest.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-layout">{children}</div>
  ),
}));

jest.mock('@/components/ui/Card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>{children}</div>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

jest.mock('@/components/ui/Button', () => ({
  Button: ({ children, asChild, ...props }: { children: React.ReactNode; asChild?: boolean; [key: string]: unknown }) => {
    if (asChild) return <>{children}</>;
    return <button {...props}>{children}</button>;
  },
}));

jest.mock('@/components/ui/Input', () => {
  const { forwardRef } = jest.requireActual<typeof import('react')>('react');
  return {
    Input: forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }>(
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

jest.mock('@/components/ui/Badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => (
    <span data-testid="badge">{children}</span>
  ),
}));

jest.mock('@/components/ui/EmptyState', () => ({
  EmptyState: ({ title, description, icon: _icon, action: _action }: { title: string; description: string; icon?: unknown; action?: unknown }) => (
    <div data-testid="empty-state">
      <p>{title}</p>
      <p>{description}</p>
    </div>
  ),
}));

jest.mock('@/components/ui/Skeleton', () => ({
  SkeletonCard: () => <div data-testid="skeleton-card" />,
}));

jest.mock('@/components/ui/LoadingSpinner', () => ({
  InlineSpinner: () => <span data-testid="inline-spinner" />,
}));

jest.mock('@/lib/utils', () => ({
  cn: (...args: (string | boolean | undefined)[]) => args.filter(Boolean).join(' '),
}));

jest.mock('react-hook-form', () => ({
  useForm: () => ({
    register: () => ({}),
    handleSubmit: (fn: (data: Record<string, unknown>) => void) => (e: { preventDefault: () => void }) => { e.preventDefault(); fn({}); },
    formState: { errors: {}, isSubmitting: false },
    reset: jest.fn(),
  }),
}));

jest.mock('@hookform/resolvers/zod', () => ({
  zodResolver: () => jest.fn(),
}));

jest.mock('@/lib/schemas/study', () => ({
  studyCreateSchema: {},
}));

jest.mock('@/components/ad/AdBanner', () => ({
  AdBanner: () => <div data-testid="ad-banner" />,
}));

jest.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return { Users: Icon, Plus: Icon, ArrowRight: Icon, Crown: Icon, Settings: Icon };
});

describe('StudiesPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('페이지 헤더가 렌더링된다', async () => {
    renderWithI18n(<StudiesPage />);
    expect(screen.getAllByText(/내 스터디/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/참여 중인 스터디를 관리하세요/)).toBeInTheDocument();
  });

  it('스터디 탐색 탭이 표시된다', () => {
    renderWithI18n(<StudiesPage />);
    expect(screen.getByText(/스터디 탐색/)).toBeInTheDocument();
  });

  it('AppLayout으로 감싸져 렌더링된다', () => {
    renderWithI18n(<StudiesPage />);
    expect(screen.getByTestId('app-layout')).toBeInTheDocument();
  });

  it('초대 코드 입력 영역이 스터디 탐색 탭에서 표시된다', () => {
    renderWithI18n(<StudiesPage />);
    const exploreTab = screen.getByText(/스터디 탐색/);
    fireEvent.click(exploreTab);
    expect(screen.getByText(/초대 코드로 가입/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/초대 코드 입력/)).toBeInTheDocument();
  });

  it('빈 상태에서 EmptyState가 표시된다', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { studyApi } = require('@/lib/api');
    studyApi.list.mockResolvedValue([]);

    renderWithI18n(<StudiesPage />);

    const empty = await screen.findByTestId('empty-state');
    expect(empty).toBeInTheDocument();
    expect(screen.getByText(/참여 중인 스터디가 없습니다/)).toBeInTheDocument();
  });
});
