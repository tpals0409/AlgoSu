import { screen } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/i18n';
import LoginPage from '../page';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useSearchParams: () => ({
    get: () => null,
  }),
}));

jest.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'light', setTheme: jest.fn() }),
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: false,
    isLoading: false,
    user: null,
    logout: jest.fn(),
  }),
}));

jest.mock('@/components/ui/Logo', () => ({
  Logo: (props: { size?: number }) => (
    <div data-testid="logo" data-size={props.size} />
  ),
}));

jest.mock('@/components/ui/Alert', () => ({
  Alert: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="alert">{children}</div>
  ),
}));

jest.mock('@/components/ui/LoadingSpinner', () => ({
  InlineSpinner: () => <span data-testid="inline-spinner" />,
}));

jest.mock('@/lib/api', () => ({
  authApi: {
    getOAuthUrl: jest.fn(),
  },
}));

jest.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return { Sun: Icon, Moon: Icon };
});

jest.mock('@/i18n/navigation', () => {
  const MockLink = ({ children, href, ...rest }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  );
  MockLink.displayName = 'MockLink';
  return {
    Link: MockLink,
    redirect: jest.fn(),
    usePathname: () => '/login',
    useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  };
});

describe('LoginPage', () => {
  it('로그인 페이지가 렌더링된다', () => {
    renderWithI18n(<LoginPage />);
    expect(screen.getByText(/AlgoSu에 오신 것을/)).toBeInTheDocument();
  });

  it('OAuth 프로바이더 버튼들이 표시된다', () => {
    renderWithI18n(<LoginPage />);
    expect(screen.getByText('Google로 계속하기')).toBeInTheDocument();
    expect(screen.getByText('네이버로 계속하기')).toBeInTheDocument();
    expect(screen.getByText('카카오로 계속하기')).toBeInTheDocument();
  });

  it('테마 전환 버튼이 존재한다', () => {
    renderWithI18n(<LoginPage />);
    expect(screen.getByRole('button', { name: '테마 전환' })).toBeInTheDocument();
  });

  it('AlgoSu 로고 링크가 표시된다', () => {
    renderWithI18n(<LoginPage />);
    expect(screen.getByText('AlgoSu')).toBeInTheDocument();
  });

  it('약관 안내 텍스트가 표시된다', () => {
    renderWithI18n(<LoginPage />);
    // 약관 영역 + footer에 각각 존재
    expect(screen.getAllByText(/이용약관/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/개인정보처리방침/).length).toBeGreaterThanOrEqual(1);
  });
});
