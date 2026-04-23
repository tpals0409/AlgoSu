import { render, screen } from '@testing-library/react';
import { AuthGuard } from '../AuthGuard';

const mockReplace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

// next-intl createNavigation → usePathname: locale prefix 제거된 경로 반환 mock
let mockPathname = '/';
jest.mock('next-intl/navigation', () => ({
  createNavigation: () => ({
    usePathname: () => mockPathname,
    useRouter: () => ({}),
    Link: () => null,
    redirect: () => null,
  }),
}));

const mockUseAuth = jest.fn();
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('@/components/ui/Skeleton', () => ({
  Skeleton: (props: { variant?: string }) => (
    <div data-testid="skeleton" data-variant={props.variant} />
  ),
}));

describe('AuthGuard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('로딩 중에는 Skeleton을 표시한다', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: true });
    render(
      <AuthGuard>
        <div>보호된 콘텐츠</div>
      </AuthGuard>,
    );
    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
    expect(screen.queryByText('보호된 콘텐츠')).not.toBeInTheDocument();
  });

  it('인증된 사용자에게 children을 렌더링한다', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true, isLoading: false });
    render(
      <AuthGuard>
        <div>보호된 콘텐츠</div>
      </AuthGuard>,
    );
    expect(screen.getByText('보호된 콘텐츠')).toBeInTheDocument();
  });

  it('미인증 사용자는 /login으로 리다이렉트된다', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: false });
    render(
      <AuthGuard>
        <div>보호된 콘텐츠</div>
      </AuthGuard>,
    );
    // jsdom 기본 pathname은 '/' → encodeURIComponent('/') = '%2F'
    expect(mockReplace).toHaveBeenCalledWith('/login?redirect=%2F');
    expect(screen.queryByText('보호된 콘텐츠')).not.toBeInTheDocument();
  });

  it('미인증 사용자는 현재 경로를 redirect 파라미터로 전달한다 (locale-aware)', () => {
    mockPathname = '/dashboard';
    mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: false });
    render(
      <AuthGuard>
        <div>보호된 콘텐츠</div>
      </AuthGuard>,
    );
    // /en/dashboard → usePathname이 locale 제거 → /dashboard
    expect(mockReplace).toHaveBeenCalledWith('/login?redirect=%2Fdashboard');
    expect(screen.queryByText('보호된 콘텐츠')).not.toBeInTheDocument();
  });
});
