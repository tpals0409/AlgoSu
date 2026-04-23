import { screen } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/i18n';
import CallbackPage from '../page';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useSearchParams: () => ({ get: () => null }),
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: false,
    isLoading: false,
    user: null,
    logout: jest.fn(),
    loginFromCookie: jest.fn(),
    updateGitHubStatus: jest.fn(),
  }),
}));

jest.mock('@/components/ui/LoadingSpinner', () => ({
  LoadingSpinner: () => <div data-testid="loading-spinner" />,
  InlineSpinner: () => <span data-testid="inline-spinner" />,
}));

jest.mock('@/components/ui/Alert', () => ({
  Alert: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="alert">{children}</div>
  ),
}));

jest.mock('@/components/ui/Card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/ui/Button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

jest.mock('@/lib/api', () => ({
  authApi: {
    linkGitHub: jest.fn(),
  },
}));

jest.mock('@/i18n/navigation', () => {
  const MockLink = ({ children, href, ...rest }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  );
  MockLink.displayName = 'MockLink';
  return {
    Link: MockLink,
    redirect: jest.fn(),
    usePathname: () => '/callback',
    useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  };
});

describe('CallbackPage', () => {
  it('콜백 페이지가 렌더링된다', () => {
    renderWithI18n(<CallbackPage />);
    expect(screen.getAllByText('로그인 처리 중...').length).toBeGreaterThanOrEqual(1);
  });

  it('로딩 스피너가 표시된다', () => {
    renderWithI18n(<CallbackPage />);
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });
});
