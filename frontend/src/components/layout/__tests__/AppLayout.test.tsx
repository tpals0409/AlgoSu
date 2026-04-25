/**
 * @file AppLayout 단위 테스트
 * @domain common
 * @layer test
 * @related AppLayout, @/i18n/navigation (H3 fix: locale-stripped usePathname)
 */

import { screen } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/i18n';
import { AppLayout } from '../AppLayout';

const mockLogout = jest.fn();
const mockUseAuth = jest.fn();
const mockUseStudy = jest.fn();
/** locale-stripped pathname mock — @/i18n/navigation 교체(H3) 검증용 */
const mockUsePathname = jest.fn().mockReturnValue('/');

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

/** next/navigation — AppLayout은 더 이상 usePathname을 여기서 가져오지 않음(H3 fix) */
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));

/**
 * @/i18n/navigation mock — locale-stripped usePathname 제공.
 * H3 fix 이후 AppLayout의 isActive()는 이 mock이 반환하는 경로를 사용한다.
 */
jest.mock('@/i18n/navigation', () => ({
  usePathname: () => mockUsePathname(),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  Link: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => <a href={href} {...rest}>{children}</a>,
  redirect: jest.fn(),
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
  useStudy: (...args: unknown[]) => mockUseStudy(...args),
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
  mockUseStudy.mockReturnValue({
    currentStudyId: null,
    currentStudyName: null,
    studies: [],
    setCurrentStudy: jest.fn(),
  });
  mockUsePathname.mockReturnValue('/');
});

describe('AppLayout', () => {
  it('renders children', () => {
    renderWithI18n(
      <AppLayout>
        <div data-testid="child">Hello</div>
      </AppLayout>,
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('renders main content area', () => {
    renderWithI18n(<AppLayout>content</AppLayout>);
    expect(screen.getByText('content')).toBeInTheDocument();
  });

  it('renders LanguageSwitcher in no-study header', () => {
    renderWithI18n(<AppLayout>content</AppLayout>);
    expect(screen.getByTestId('language-switcher')).toBeInTheDocument();
  });

  it('does not show session expired overlay (moved to login page)', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: { email: 'test@example.com', avatarPreset: 'default' },
      logout: mockLogout,
      sessionExpired: true,
    });

    renderWithI18n(<AppLayout>content</AppLayout>);
    expect(screen.queryByText('세션이 만료되었습니다')).not.toBeInTheDocument();
  });
});

/**
 * H3 fix 회귀 테스트 —
 * usePathname을 next/navigation → @/i18n/navigation(locale-stripped)으로 교체한 뒤
 * isActive() 비교 로직이 locale prefix 없는 경로를 받는지 검증한다.
 *
 * 영어 로케일에서 next/navigation이 '/en/dashboard'를 반환하면
 * isActive('/dashboard') === false 로 사이드바 전체 비활성화 — 이 버그를 방지.
 */
describe('AppLayout isActive — locale-aware pathname (H3)', () => {
  beforeEach(() => {
    // 사이드바가 렌더되려면 hasStudy = true 필요
    mockUseStudy.mockReturnValue({
      currentStudyId: 'study-1',
      currentStudyName: '테스트 스터디',
      studies: [{ id: 'study-1', name: '테스트 스터디', avatar_url: null }],
      setCurrentStudy: jest.fn(),
    });
  });

  it('locale-stripped /dashboard 경로에서 대시보드 nav가 활성화된다', () => {
    // @/i18n/navigation.usePathname이 locale prefix 없는 '/dashboard' 반환
    // — 영어 로케일이라도 locale-stripped이므로 isActive('/dashboard') === true
    mockUsePathname.mockReturnValue('/dashboard');
    renderWithI18n(<AppLayout>content</AppLayout>);
    const dashboardLink = screen.getByRole('link', { name: /대시보드/ });
    expect(dashboardLink.className).toContain('bg-primary-soft');
  });

  it('다른 경로 /problems에서 대시보드 nav가 비활성화된다', () => {
    mockUsePathname.mockReturnValue('/problems');
    renderWithI18n(<AppLayout>content</AppLayout>);
    const dashboardLink = screen.getByRole('link', { name: /대시보드/ });
    expect(dashboardLink.className).not.toContain('bg-primary-soft');
  });

  it('@/i18n/navigation.usePathname이 호출된다 (next/navigation 아님)', () => {
    mockUsePathname.mockReturnValue('/dashboard');
    renderWithI18n(<AppLayout>content</AppLayout>);
    // mockUsePathname이 호출됐다면 AppLayout이 @/i18n/navigation을 사용 중
    expect(mockUsePathname).toHaveBeenCalled();
  });
});
