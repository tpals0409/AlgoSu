import { render, screen } from '@testing-library/react';
import { TopNav } from '../TopNav';

jest.mock('lucide-react', () => {
  const Icon = (props: any) => <svg {...props} />;
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
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  usePathname: () => '/',
}));

jest.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'light', setTheme: jest.fn() }),
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: { email: 'test@example.com', avatarPreset: 'default' },
    logout: jest.fn(),
  }),
}));

jest.mock('@/contexts/StudyContext', () => ({
  useStudy: () => ({
    currentStudyId: 'study-1',
    studies: [{ id: 'study-1', name: 'Test Study' }],
    setCurrentStudy: jest.fn(),
  }),
}));

jest.mock('@/components/layout/NotificationBell', () => ({
  NotificationBell: () => <div data-testid="notification-bell" />,
}));

jest.mock('@/lib/avatars', () => ({
  getAvatarSrc: () => '/avatar.png',
}));

describe('TopNav', () => {
  it('renders the header element', () => {
    render(<TopNav />);
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('renders navigation with aria-label', () => {
    render(<TopNav />);
    expect(screen.getByRole('navigation', { name: '주 내비게이션' })).toBeInTheDocument();
  });

  it('renders the logo link with text AlgoSu', () => {
    render(<TopNav />);
    expect(screen.getByText('AlgoSu')).toBeInTheDocument();
  });

  it('renders navigation links when authenticated with study', () => {
    render(<TopNav />);
    expect(screen.getByText('대시보드')).toBeInTheDocument();
    expect(screen.getByText('문제')).toBeInTheDocument();
    expect(screen.getByText('제출')).toBeInTheDocument();
    expect(screen.getByText('분석')).toBeInTheDocument();
  });

  it('renders theme toggle button with aria-label', () => {
    render(<TopNav />);
    expect(screen.getByRole('button', { name: '테마 전환' })).toBeInTheDocument();
  });
});
