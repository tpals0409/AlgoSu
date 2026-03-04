import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppLayout } from '../AppLayout';

const mockLogout = jest.fn();
const mockUseAuth = jest.fn();

jest.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return {
    Clock: Icon,
    Sun: Icon,
    Moon: Icon,
    ChevronDown: Icon,
    Menu: Icon,
    X: Icon,
    User: Icon,
    Settings: Icon,
    LogOut: Icon,
  };
});

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  usePathname: () => '/',
}));

jest.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'light', setTheme: jest.fn() }),
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: (...args: unknown[]) => mockUseAuth(...args),
}));

jest.mock('@/contexts/StudyContext', () => ({
  useStudy: () => ({
    currentStudyId: null,
    studies: [],
    setCurrentStudy: jest.fn(),
  }),
}));

jest.mock('@/components/layout/NotificationBell', () => ({
  NotificationBell: () => <div data-testid="notification-bell" />,
}));

jest.mock('@/components/layout/TopNav', () => ({
  TopNav: () => <nav data-testid="top-nav">TopNav</nav>,
}));

jest.mock('@/lib/avatars', () => ({
  getAvatarSrc: () => '/avatar.png',
}));

beforeEach(() => {
  mockLogout.mockClear();
  mockUseAuth.mockReturnValue({
    isAuthenticated: true,
    user: { email: 'test@example.com', avatarPreset: 'default' },
    logout: mockLogout,
    sessionExpired: false,
  });
});

describe('AppLayout', () => {
  it('renders children and TopNav', () => {
    render(
      <AppLayout>
        <div data-testid="child">Hello</div>
      </AppLayout>,
    );
    expect(screen.getByTestId('top-nav')).toBeInTheDocument();
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('renders footer with copyright', () => {
    render(<AppLayout>content</AppLayout>);
    const year = new Date().getFullYear().toString();
    expect(screen.getByText(new RegExp(`${year}.*AlgoSu`))).toBeInTheDocument();
  });

  it('does not show session expired overlay by default', () => {
    render(<AppLayout>content</AppLayout>);
    expect(screen.queryByText('세션이 만료되었습니다')).not.toBeInTheDocument();
  });

  it('shows session expired overlay and logout button when expired', async () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: { email: 'test@example.com', avatarPreset: 'default' },
      logout: mockLogout,
      sessionExpired: true,
    });

    render(<AppLayout>content</AppLayout>);
    expect(screen.getByText('세션이 만료되었습니다')).toBeInTheDocument();
    expect(screen.getByText('다시 로그인')).toBeInTheDocument();

    await userEvent.click(screen.getByText('다시 로그인'));
    expect(mockLogout).toHaveBeenCalled();
  });
});
