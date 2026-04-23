import { render, screen } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/i18n';
import { FeatureCards } from '../FeatureCards';
import { HeroButtons } from '../HeroButtons';
import { HomeRedirect } from '../HomeRedirect';

// ─── Common Mocks ────────────────────────

const mockReplace = jest.fn();
const mockUseAuth = jest.fn();

jest.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return {
    BookOpen: Icon,
    GitBranch: Icon,
    Zap: Icon,
    Code2: Icon,
    Github: Icon,
    Users: Icon,
    BarChart2: Icon,
    MessageSquareCode: Icon,
    CheckSquare: Icon,
    ArrowRight: Icon,
  };
});

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: (...args: unknown[]) => mockUseAuth(...args),
}));

// Mock useInView - mutable for per-test control
let mockVisible = true;
jest.mock('@/hooks/useInView', () => ({
  useInView: () => [{ current: null }, mockVisible],
}));

// Mock next/link
jest.mock('next/link', () => {
  const MockLink = ({ children, href, ...rest }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
});

// Mock Button component with asChild support
jest.mock('@/components/ui/Button', () => ({
  Button: ({ children, asChild, ...props }: { children: React.ReactNode; asChild?: boolean; [key: string]: unknown }) => {
    if (asChild) {
      return <>{children}</>;
    }
    return <button {...props}>{children}</button>;
  },
}));

beforeEach(() => {
  mockReplace.mockClear();
  mockVisible = true;
  mockUseAuth.mockReturnValue({
    isAuthenticated: false,
    isLoading: false,
  });
});

// ─── FeatureCards ─────────────────────────

describe('FeatureCards', () => {
  it('renders six feature cards with titles', () => {
    renderWithI18n(<FeatureCards />);
    expect(screen.getByText('AI 코드 분석')).toBeInTheDocument();
    expect(screen.getByText('GitHub 자동 동기화')).toBeInTheDocument();
    expect(screen.getByText('스터디 협업')).toBeInTheDocument();
    expect(screen.getByText('통계 대시보드')).toBeInTheDocument();
    expect(screen.getByText('코드 리뷰')).toBeInTheDocument();
    expect(screen.getByText('진도 관리')).toBeInTheDocument();
  });

  it('renders the section heading', () => {
    renderWithI18n(<FeatureCards />);
    expect(screen.getByText('스터디에 필요한 모든 것')).toBeInTheDocument();
  });

  it('visible=false이면 opacity:0 스타일을 적용한다', () => {
    mockVisible = false;
    renderWithI18n(<FeatureCards />);
    // The heading div should have opacity 0 when not visible
    const section = document.querySelector('#features');
    expect(section).toBeInTheDocument();
    // opacity 0 and translateY(28px) are applied via inline style
    const headingDiv = section!.querySelector('div');
    expect(headingDiv).toHaveStyle({ opacity: 0 });
  });

  it('visible=true이면 opacity:1 스타일을 적용한다', () => {
    mockVisible = true;
    renderWithI18n(<FeatureCards />);
    const section = document.querySelector('#features');
    const headingDiv = section!.querySelector('div');
    expect(headingDiv).toHaveStyle({ opacity: 1 });
  });
});

// ─── HeroButtons ─────────────────────────

describe('HeroButtons', () => {
  it('renders login and demo links', () => {
    renderWithI18n(<HeroButtons />);
    const loginLink = screen.getByText('무료로 시작하기');
    expect(loginLink).toBeInTheDocument();
    expect(loginLink.closest('a')).toHaveAttribute('href', '/login');

    const featureLink = screen.getByText('핵심 기능');
    expect(featureLink).toBeInTheDocument();
    expect(featureLink.closest('a')).toHaveAttribute('href', '#features');
  });
});

// ─── HomeRedirect ────────────────────────

describe('HomeRedirect', () => {
  it('does not redirect when not authenticated', () => {
    render(<HomeRedirect />);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('does not redirect while loading', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
    });
    render(<HomeRedirect />);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('redirects to /studies when authenticated', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });
    render(<HomeRedirect />);
    expect(mockReplace).toHaveBeenCalledWith('/studies');
  });
});
