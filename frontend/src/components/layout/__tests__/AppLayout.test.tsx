import { render, screen } from '@testing-library/react';
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
    Check: Icon,
    Plus: Icon,
    Menu: Icon,
    X: Icon,
    User: Icon,
    LayoutDashboard: Icon,
    Users: Icon,
    BookOpen: Icon,
    FileText: Icon,
    MessagesSquare: Icon,
    BarChart3: Icon,
    LogOut: Icon,
    Settings: Icon,
    Shield: Icon,
  };
});

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  usePathname: () => '/',
}));

jest.mock('next/link', () => {
  const MockLink = ({ children, ...props }: { children: React.ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
});

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => <img {...props} />,
}));

jest.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'light', setTheme: jest.fn() }),
}));

jest.mock('sonner', () => ({
  Toaster: () => <div data-testid="toaster" />,
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: (...args: unknown[]) => mockUseAuth(...args),
}));

jest.mock('@/contexts/StudyContext', () => ({
  useStudy: () => ({
    currentStudyId: null,
    currentStudyName: null,
    studies: [],
    setCurrentStudy: jest.fn(),
  }),
}));

jest.mock('@/components/layout/NotificationBell', () => ({
  NotificationBell: () => <div data-testid="notification-bell" />,
}));

jest.mock('@/lib/avatars', () => ({
  getAvatarSrc: () => '/avatar.png',
  getAvatarPresetKey: (v: string) => v ?? 'default',
}));

jest.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

jest.mock('@/components/feedback/FeedbackWidget', () => ({
  FeedbackWidget: () => <div data-testid="feedback-widget" />,
}));

jest.mock('@/components/ui/Logo', () => ({
  Logo: () => <div data-testid="logo" />,
}));

jest.mock('@/components/layout/LanguageSwitcher', () => ({
  LanguageSwitcher: () => <div data-testid="language-switcher" />,
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
  it('renders children', () => {
    render(
      <AppLayout>
        <div data-testid="child">Hello</div>
      </AppLayout>,
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('renders main content area', () => {
    render(<AppLayout>content</AppLayout>);
    expect(screen.getByText('content')).toBeInTheDocument();
  });

  it('renders LanguageSwitcher in no-study header', () => {
    render(<AppLayout>content</AppLayout>);
    expect(screen.getByTestId('language-switcher')).toBeInTheDocument();
  });

  it('does not show session expired overlay (moved to login page)', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: { email: 'test@example.com', avatarPreset: 'default' },
      logout: mockLogout,
      sessionExpired: true,
    });

    render(<AppLayout>content</AppLayout>);
    expect(screen.queryByText('세션이 만료되었습니다')).not.toBeInTheDocument();
  });
});
