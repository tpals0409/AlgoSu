import { render, screen } from '@testing-library/react';
import StudiesPage from '../page';

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn() }),
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

jest.mock('@/components/ui/Input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} />
  ),
}));

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
  EmptyState: ({ title, description }: { title: string; description: string }) => (
    <div data-testid="empty-state">
      <p>{title}</p>
      <p>{description}</p>
    </div>
  ),
}));

jest.mock('@/components/ui/Skeleton', () => ({
  SkeletonCard: () => <div data-testid="skeleton-card" />,
}));

jest.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return { Users: Icon, Plus: Icon, ArrowRight: Icon };
});

describe('StudiesPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('페이지 헤더가 렌더링된다', async () => {
    render(<StudiesPage />);
    expect(screen.getByText('내 스터디')).toBeInTheDocument();
    expect(screen.getByText('참여 중인 스터디를 선택하거나 새로 만드세요.')).toBeInTheDocument();
  });

  it('스터디 만들기 링크가 표시된다', () => {
    render(<StudiesPage />);
    expect(screen.getByText('스터디 만들기')).toBeInTheDocument();
  });

  it('AppLayout으로 감싸져 렌더링된다', () => {
    render(<StudiesPage />);
    expect(screen.getByTestId('app-layout')).toBeInTheDocument();
  });

  it('초대 코드 입력 영역이 표시된다', () => {
    render(<StudiesPage />);
    expect(screen.getByText('초대 코드로 가입')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('초대 코드 입력')).toBeInTheDocument();
  });

  it('빈 상태에서 EmptyState가 표시된다', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { studyApi } = require('@/lib/api');
    studyApi.list.mockResolvedValue([]);

    render(<StudiesPage />);

    const empty = await screen.findByTestId('empty-state');
    expect(empty).toBeInTheDocument();
    expect(screen.getByText('참여 중인 스터디가 없습니다')).toBeInTheDocument();
  });
});
