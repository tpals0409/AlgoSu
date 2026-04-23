import { screen, fireEvent, act } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/i18n';
import { TopNav } from '../TopNav';

// ─── MOCK CONTROL VARIABLES ───────────────────────────────────────────────────
// These variables are closed over by the mock factories so they can be
// mutated per-test to alter the behavior of each mock hook.

let mockIsAuthenticated = true;
let mockStudies: { id: string; name: string }[] = [{ id: 'study-1', name: 'Test Study' }];
let mockCurrentStudyId: string | null = 'study-1';
let mockTheme = 'light';
let mockPathname = '/';
let mockUserEmail: string | undefined = 'test@example.com';
let mockUserAvatarPreset: string | undefined = 'default';

const mockLogout = jest.fn();
const mockSetCurrentStudy = jest.fn();
const mockSetTheme = jest.fn();
const mockRouterPush = jest.fn();

// ─── MOCKS ────────────────────────────────────────────────────────────────────

jest.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return {
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
  useRouter: () => ({ push: mockRouterPush, back: jest.fn() }),
  usePathname: () => mockPathname,
}));

jest.mock('next-themes', () => ({
  useTheme: () => ({ theme: mockTheme, setTheme: mockSetTheme }),
}));

let mockUser: { email: string | undefined; avatarPreset: string | undefined } | null = null;

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: mockIsAuthenticated,
    user: mockUser,
    logout: mockLogout,
  }),
}));

jest.mock('@/contexts/StudyContext', () => ({
  useStudy: () => ({
    currentStudyId: mockCurrentStudyId,
    studies: mockStudies,
    setCurrentStudy: mockSetCurrentStudy,
  }),
}));

jest.mock('@/components/layout/NotificationBell', () => ({
  NotificationBell: () => <div data-testid="notification-bell" />,
}));

jest.mock('@/components/layout/LanguageSwitcher', () => ({
  LanguageSwitcher: () => <div data-testid="language-switcher" />,
}));

jest.mock('@/lib/avatars', () => ({
  getAvatarSrc: () => '/avatar.png',
  getAvatarPresetKey: (v: string) => v,
}));

jest.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => (args.filter(Boolean) as string[]).join(' '),
}));

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function resetDefaults() {
  mockIsAuthenticated = true;
  mockStudies = [{ id: 'study-1', name: 'Test Study' }];
  mockCurrentStudyId = 'study-1';
  mockTheme = 'light';
  mockPathname = '/';
  mockUserEmail = 'test@example.com';
  mockUserAvatarPreset = 'default';
  mockUser = { email: mockUserEmail, avatarPreset: mockUserAvatarPreset };
  jest.clearAllMocks();
}

// ─── TESTS ────────────────────────────────────────────────────────────────────

describe('TopNav — basic rendering', () => {
  beforeEach(resetDefaults);

  it('header element is rendered', () => {
    renderWithI18n(<TopNav />);
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('main navigation aria-label is rendered', () => {
    renderWithI18n(<TopNav />);
    expect(screen.getByRole('navigation', { name: /내비게이션/ })).toBeInTheDocument();
  });

  it('logo text AlgoSu is rendered', () => {
    renderWithI18n(<TopNav />);
    expect(screen.getByText('AlgoSu')).toBeInTheDocument();
  });

  it('nav links are rendered when authenticated with study', () => {
    renderWithI18n(<TopNav />);
    expect(screen.getByText('대시보드')).toBeInTheDocument();
    expect(screen.getByText('문제')).toBeInTheDocument();
    expect(screen.getByText('제출')).toBeInTheDocument();
    expect(screen.getByText('스터디룸')).toBeInTheDocument();
    expect(screen.getByText('분석')).toBeInTheDocument();
  });

  it('theme toggle button is rendered', () => {
    renderWithI18n(<TopNav />);
    expect(screen.getByRole('button', { name: /테마 전환/ })).toBeInTheDocument();
  });

  it('NotificationBell is rendered when authenticated', () => {
    renderWithI18n(<TopNav />);
    expect(screen.getByTestId('notification-bell')).toBeInTheDocument();
  });
});

// ─── Unauthenticated ─────────────────────────────────────────────────────────

describe('TopNav — unauthenticated', () => {
  beforeEach(() => {
    resetDefaults();
    mockIsAuthenticated = false;
    mockUser = null;
    mockStudies = [];
    mockCurrentStudyId = null;
  });

  it('shows login link', () => {
    renderWithI18n(<TopNav />);
    expect(screen.getByText('로그인')).toBeInTheDocument();
  });

  it('does not show nav links', () => {
    renderWithI18n(<TopNav />);
    expect(screen.queryByText('대시보드')).not.toBeInTheDocument();
  });

  it('does not show mobile hamburger button', () => {
    renderWithI18n(<TopNav />);
    expect(screen.queryByRole('button', { name: /메뉴/ })).not.toBeInTheDocument();
  });

  it('does not show StudySelector', () => {
    renderWithI18n(<TopNav />);
    expect(screen.queryByRole('button', { name: /스터디 전환/ })).not.toBeInTheDocument();
    expect(screen.queryByText('스터디 선택')).not.toBeInTheDocument();
  });
});

// ─── StudySelector — no studies ─────────────────────────────────────────────

describe('TopNav — StudySelector (authenticated, no studies)', () => {
  beforeEach(() => {
    resetDefaults();
    // Authenticated but no studies => renders "Select Study" link
    mockStudies = [];
    mockCurrentStudyId = null;
  });

  it('shows "Select Study" link', () => {
    renderWithI18n(<TopNav />);
    expect(screen.getByRole('link', { name: /스터디 선택/ })).toBeInTheDocument();
  });

  it('"Select Study" link points to /studies', () => {
    renderWithI18n(<TopNav />);
    const link = screen.getByRole('link', { name: /스터디 선택/ });
    expect(link).toHaveAttribute('href', '/studies');
  });
});

// ─── StudySelector — dropdown ─────────────────────────────────────────────────

describe('TopNav — StudySelector dropdown', () => {
  beforeEach(() => {
    resetDefaults();
    mockStudies = [
      { id: 'study-1', name: 'Test Study' },
      { id: 'study-2', name: 'Another Study' },
    ];
    mockCurrentStudyId = 'study-1';
  });

  it('switch study button is rendered', () => {
    renderWithI18n(<TopNav />);
    expect(screen.getByRole('button', { name: /스터디 전환/ })).toBeInTheDocument();
  });

  it('dropdown opens on button click', () => {
    renderWithI18n(<TopNav />);
    fireEvent.click(screen.getByRole('button', { name: /스터디 전환/ }));
    expect(screen.getByRole('listbox', { name: /스터디 목록/ })).toBeInTheDocument();
  });

  it('dropdown shows study list', () => {
    renderWithI18n(<TopNav />);
    fireEvent.click(screen.getByRole('button', { name: /스터디 전환/ }));
    const listbox = screen.getByRole('listbox', { name: /스터디 목록/ });
    expect(listbox).toBeInTheDocument();
    // Options contain initial letter + study name
    const options = listbox.querySelectorAll('[role="option"]');
    expect(options).toHaveLength(2);
    expect(listbox).toHaveTextContent('Test Study');
    expect(listbox).toHaveTextContent('Another Study');
  });

  it('selecting a study calls setCurrentStudy and closes dropdown', () => {
    renderWithI18n(<TopNav />);
    fireEvent.click(screen.getByRole('button', { name: /스터디 전환/ }));
    const listbox = screen.getByRole('listbox', { name: /스터디 목록/ });
    const options = listbox.querySelectorAll('[role="option"]');
    // Click the second option (Another Study)
    fireEvent.click(options[1]);
    expect(mockSetCurrentStudy).toHaveBeenCalledWith('study-2');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('selecting a study closes dropdown', () => {
    renderWithI18n(<TopNav />);
    fireEvent.click(screen.getByRole('button', { name: /스터디 전환/ }));
    const listbox = screen.getByRole('listbox');
    expect(listbox).toBeInTheDocument();
    const options = listbox.querySelectorAll('[role="option"]');
    fireEvent.click(options[0]);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('re-clicking button closes dropdown (toggle)', () => {
    renderWithI18n(<TopNav />);
    const btn = screen.getByRole('button', { name: /스터디 전환/ });
    fireEvent.click(btn);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.click(btn);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('clicking outside closes dropdown', () => {
    renderWithI18n(<TopNav />);
    fireEvent.click(screen.getByRole('button', { name: /스터디 전환/ }));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    act(() => {
      fireEvent.mouseDown(document.body);
    });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('shows "Select Study" text in button when no current study', () => {
    mockCurrentStudyId = null;
    renderWithI18n(<TopNav />);
    expect(screen.getByRole('button', { name: /스터디 전환/ })).toHaveTextContent(/스터디 선택/);
  });
});

// ─── ProfileDropdown ──────────────────────────────────────────────────────────

describe('TopNav — ProfileDropdown', () => {
  beforeEach(resetDefaults);

  it('profile image button is rendered', () => {
    renderWithI18n(<TopNav />);
    expect(screen.getByRole('button', { name: /프로필 메뉴/ })).toBeInTheDocument();
  });

  it('dropdown opens on profile button click', () => {
    renderWithI18n(<TopNav />);
    fireEvent.click(screen.getByRole('button', { name: /프로필 메뉴/ }));
    expect(screen.getByRole('menu', { name: /프로필 메뉴/ })).toBeInTheDocument();
  });

  it('dropdown shows user email', () => {
    renderWithI18n(<TopNav />);
    fireEvent.click(screen.getByRole('button', { name: /프로필 메뉴/ }));
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('dropdown shows profile/settings links', () => {
    renderWithI18n(<TopNav />);
    fireEvent.click(screen.getByRole('button', { name: /프로필 메뉴/ }));
    expect(screen.getByRole('menuitem', { name: /프로필/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /설정/ })).toBeInTheDocument();
  });

  it('clicking logout calls logout', () => {
    renderWithI18n(<TopNav />);
    fireEvent.click(screen.getByRole('button', { name: /프로필 메뉴/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: /로그아웃/ }));
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('dropdown closes after logout', () => {
    renderWithI18n(<TopNav />);
    fireEvent.click(screen.getByRole('button', { name: /프로필 메뉴/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: /로그아웃/ }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('re-clicking profile button closes dropdown (toggle)', () => {
    renderWithI18n(<TopNav />);
    const btn = screen.getByRole('button', { name: /프로필 메뉴/ });
    fireEvent.click(btn);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.click(btn);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('clicking outside closes profile dropdown', () => {
    renderWithI18n(<TopNav />);
    fireEvent.click(screen.getByRole('button', { name: /프로필 메뉴/ }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    act(() => {
      fireEvent.mouseDown(document.body);
    });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('clicking profile menu item closes dropdown', () => {
    renderWithI18n(<TopNav />);
    fireEvent.click(screen.getByRole('button', { name: /프로필 메뉴/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: /프로필/ }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('clicking settings menu item closes dropdown', () => {
    renderWithI18n(<TopNav />);
    fireEvent.click(screen.getByRole('button', { name: /프로필 메뉴/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: /설정/ }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});

// ─── Theme toggle ────────────────────────────────────────────────────────────

describe('TopNav — theme toggle', () => {
  beforeEach(resetDefaults);

  it('clicking in light theme requests dark', () => {
    mockTheme = 'light';
    renderWithI18n(<TopNav />);
    fireEvent.click(screen.getByRole('button', { name: /테마 전환/ }));
    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });

  it('clicking in dark theme requests light', () => {
    mockTheme = 'dark';
    renderWithI18n(<TopNav />);
    fireEvent.click(screen.getByRole('button', { name: /테마 전환/ }));
    expect(mockSetTheme).toHaveBeenCalledWith('light');
  });
});

// ─── Mobile menu ─────────────────────────────────────────────────────────────

describe('TopNav — mobile menu', () => {
  beforeEach(resetDefaults);

  it('open menu button is rendered when hasStudy', () => {
    renderWithI18n(<TopNav />);
    expect(screen.getByRole('button', { name: /메뉴 열기/ })).toBeInTheDocument();
  });

  it('clicking open menu button switches to close menu button', () => {
    renderWithI18n(<TopNav />);
    fireEvent.click(screen.getByRole('button', { name: /메뉴 열기/ }));
    expect(screen.getByRole('button', { name: /메뉴 닫기/ })).toBeInTheDocument();
  });

  it('mobile dropdown shows nav links', () => {
    renderWithI18n(<TopNav />);
    fireEvent.click(screen.getByRole('button', { name: /메뉴 열기/ }));
    const dashLinks = screen.getAllByText('대시보드');
    expect(dashLinks.length).toBeGreaterThanOrEqual(1);
  });

  it('clicking close menu button closes dropdown', () => {
    renderWithI18n(<TopNav />);
    fireEvent.click(screen.getByRole('button', { name: /메뉴 열기/ }));
    fireEvent.click(screen.getByRole('button', { name: /메뉴 닫기/ }));
    expect(screen.getByRole('button', { name: /메뉴 열기/ })).toBeInTheDocument();
  });

  it('clicking a mobile menu link closes the menu', () => {
    renderWithI18n(<TopNav />);
    fireEvent.click(screen.getByRole('button', { name: /메뉴 열기/ }));
    const allDashLinks = screen.getAllByRole('link', { name: '대시보드' });
    fireEvent.click(allDashLinks[allDashLinks.length - 1]);
    expect(screen.getByRole('button', { name: /메뉴 열기/ })).toBeInTheDocument();
  });

  it('mobileMenuOpen=true sets document.body.style.overflow=hidden', () => {
    renderWithI18n(<TopNav />);
    fireEvent.click(screen.getByRole('button', { name: /메뉴 열기/ }));
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('mobileMenuOpen=false restores document.body.style.overflow', () => {
    renderWithI18n(<TopNav />);
    fireEvent.click(screen.getByRole('button', { name: /메뉴 열기/ }));
    fireEvent.click(screen.getByRole('button', { name: /메뉴 닫기/ }));
    expect(document.body.style.overflow).toBe('');
  });
});

// ─── Active path styling ─────────────────────────────────────────────────────

describe('TopNav — active path styling', () => {
  beforeEach(resetDefaults);

  it('/dashboard path gives dashboard link active class', () => {
    mockPathname = '/dashboard';
    renderWithI18n(<TopNav />);
    const links = screen.getAllByRole('link', { name: '대시보드' });
    const hasActive = links.some(
      (el) =>
        el.className.includes('bg-primary-soft') && el.className.includes('text-primary'),
    );
    expect(hasActive).toBe(true);
  });

  it('/dashboard/sub path also gives dashboard active', () => {
    mockPathname = '/dashboard/sub';
    renderWithI18n(<TopNav />);
    const links = screen.getAllByRole('link', { name: '대시보드' });
    const hasActive = links.some(
      (el) =>
        el.className.includes('bg-primary-soft') && el.className.includes('text-primary'),
    );
    expect(hasActive).toBe(true);
  });

  it('/ path gives no nav link active', () => {
    mockPathname = '/';
    renderWithI18n(<TopNav />);
    const links = screen.getAllByRole('link', { name: '대시보드' });
    const hasActive = links.some(
      (el) =>
        el.className.includes('bg-primary-soft') && el.className.includes('text-primary'),
    );
    expect(hasActive).toBe(false);
  });

  it('/dashboard path shows active link in mobile menu', () => {
    mockPathname = '/dashboard';
    renderWithI18n(<TopNav />);
    fireEvent.click(screen.getByRole('button', { name: /메뉴 열기/ }));
    const mobileLinks = screen.getAllByRole('link', { name: '대시보드' });
    const hasActiveMobile = mobileLinks.some(
      (el) => el.className.includes('bg-primary-soft') && el.className.includes('text-primary'),
    );
    expect(hasActiveMobile).toBe(true);
  });
});

describe('TopNav — ProfileDropdown user null cases', () => {
  beforeEach(() => {
    resetDefaults();
    mockIsAuthenticated = true;
  });

  it('empty email renders profile menu aria-label', () => {
    renderWithI18n(<TopNav />);
    const profileBtn = screen.getByRole('button', { name: /프로필 메뉴/ });
    expect(profileBtn).toBeInTheDocument();
  });

  it('undefined email shows empty string in dropdown (user?.email ?? "" branch)', () => {
    mockUserEmail = undefined;
    mockUser = { email: undefined, avatarPreset: 'default' };
    renderWithI18n(<TopNav />);
    fireEvent.click(screen.getByRole('button', { name: /프로필 메뉴/ }));
    expect(screen.getByRole('menu', { name: /프로필 메뉴/ })).toBeInTheDocument();
  });

  it('undefined avatarPreset uses default avatar (avatarPreset ?? "default" branch)', () => {
    mockUserAvatarPreset = undefined;
    mockUser = { email: 'test@example.com', avatarPreset: undefined };
    renderWithI18n(<TopNav />);
    const img = screen.getByAltText(/test@example.com/);
    expect(img).toBeInTheDocument();
  });

  it('clicking outside StudySelector closes it (ref.current && !ref.current.contains branch)', () => {
    renderWithI18n(<TopNav />);
    fireEvent.click(screen.getByRole('button', { name: /스터디 전환/ }));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    act(() => {
      fireEvent.mouseDown(document.body);
    });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('clicking inside StudySelector keeps dropdown open (ref.current.contains() = true branch)', () => {
    renderWithI18n(<TopNav />);
    fireEvent.click(screen.getByRole('button', { name: /스터디 전환/ }));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    const listbox = screen.getByRole('listbox');
    act(() => {
      fireEvent.mouseDown(listbox);
    });
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('clicking outside ProfileDropdown closes it (ref.current && !ref.current.contains branch)', () => {
    renderWithI18n(<TopNav />);
    fireEvent.click(screen.getByRole('button', { name: /프로필 메뉴/ }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    act(() => {
      fireEvent.mouseDown(document.body);
    });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('null user shows empty email and default avatar (null branch)', () => {
    mockUser = null;
    renderWithI18n(<TopNav />);
    const profileBtn = screen.getByRole('button', { name: /프로필 메뉴/ });
    expect(profileBtn).toBeInTheDocument();
    expect(screen.getByAltText(/아바타/)).toBeInTheDocument();
    fireEvent.click(profileBtn);
    expect(screen.getByRole('menu', { name: /프로필 메뉴/ })).toBeInTheDocument();
  });

  it('clicking inside ProfileDropdown keeps it open (ref.current.contains() = true branch)', () => {
    renderWithI18n(<TopNav />);
    fireEvent.click(screen.getByRole('button', { name: /프로필 메뉴/ }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    const menu = screen.getByRole('menu');
    act(() => {
      fireEvent.mouseDown(menu);
    });
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });
});
