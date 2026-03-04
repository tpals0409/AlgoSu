import { render, screen } from '@testing-library/react';
import { FeatureCards } from '../FeatureCards';
import { HeroButtons } from '../HeroButtons';
import { HomeRedirect } from '../HomeRedirect';

// ─── Common Mocks ────────────────────────

const mockReplace = jest.fn();
const mockUseAuth = jest.fn();

jest.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return { BookOpen: Icon, GitBranch: Icon, Zap: Icon };
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
  it('renders three feature cards with titles', () => {
    render(<FeatureCards />);
    expect(screen.getByText('체계적인 문제 관리')).toBeInTheDocument();
    expect(screen.getByText('GitHub 자동 동기화')).toBeInTheDocument();
    expect(screen.getByText('AI 코드 리뷰')).toBeInTheDocument();
  });

  it('renders the section heading', () => {
    render(<FeatureCards />);
    expect(screen.getByText('스터디에 필요한 모든 것')).toBeInTheDocument();
    expect(screen.getByText('핵심 기능')).toBeInTheDocument();
  });

  it('visible=false이면 opacity:0 스타일을 적용한다', () => {
    mockVisible = false;
    render(<FeatureCards />);
    // The heading div should have opacity 0 when not visible
    const section = document.querySelector('#features');
    expect(section).toBeInTheDocument();
    // opacity 0 and translateY(28px) are applied via inline style
    const headingDiv = section!.querySelector('div');
    expect(headingDiv).toHaveStyle({ opacity: 0 });
  });

  it('visible=true이면 opacity:1 스타일을 적용한다', () => {
    mockVisible = true;
    render(<FeatureCards />);
    const section = document.querySelector('#features');
    const headingDiv = section!.querySelector('div');
    expect(headingDiv).toHaveStyle({ opacity: 1 });
  });
});

// ─── HeroButtons ─────────────────────────

describe('HeroButtons', () => {
  it('renders login and features links', () => {
    render(<HeroButtons />);
    const loginLink = screen.getByText('무료로 시작하기');
    expect(loginLink).toBeInTheDocument();
    expect(loginLink.closest('a')).toHaveAttribute('href', '/login');

    const featuresLink = screen.getByText('둘러보기');
    expect(featuresLink).toBeInTheDocument();
    expect(featuresLink.closest('a')).toHaveAttribute('href', '#features');
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

  it('redirects to /dashboard when authenticated', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });
    render(<HomeRedirect />);
    expect(mockReplace).toHaveBeenCalledWith('/dashboard');
  });
});
