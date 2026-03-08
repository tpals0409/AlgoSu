import { render, screen } from '@testing-library/react';
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

describe('LoginPage', () => {
  it('로그인 페이지가 렌더링된다', () => {
    render(<LoginPage />);
    expect(screen.getByText(/AlgoSu에 오신 것을/)).toBeInTheDocument();
  });

  it('OAuth 프로바이더 버튼들이 표시된다', () => {
    render(<LoginPage />);
    expect(screen.getByText('Google로 계속하기')).toBeInTheDocument();
    expect(screen.getByText('네이버로 계속하기')).toBeInTheDocument();
    expect(screen.getByText('카카오로 계속하기')).toBeInTheDocument();
  });

  it('테마 전환 버튼이 존재한다', () => {
    render(<LoginPage />);
    expect(screen.getByRole('button', { name: '테마 전환' })).toBeInTheDocument();
  });

  it('AlgoSu 로고 링크가 표시된다', () => {
    render(<LoginPage />);
    expect(screen.getByText('AlgoSu')).toBeInTheDocument();
  });

  it('약관 안내 텍스트가 표시된다', () => {
    render(<LoginPage />);
    expect(screen.getByText(/서비스 이용약관/)).toBeInTheDocument();
    expect(screen.getByText(/개인정보처리방침/)).toBeInTheDocument();
  });
});
