import { render, screen } from '@testing-library/react';
import LandingPage from '../page';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

jest.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'light', setTheme: jest.fn() }),
}));

jest.mock('next/link', () => {
  return {
    __esModule: true,
    default: ({ children, href }: { children: React.ReactNode; href: string }) => (
      <a href={href}>{children}</a>
    ),
  };
});

jest.mock('@/components/ui/Logo', () => ({
  Logo: (props: { size?: number }) => (
    <div data-testid="logo" data-size={props.size} />
  ),
}));

jest.mock('@/components/ui/DiffBadge', () => ({
  DiffBadge: ({ tier }: { tier: string }) => (
    <span data-testid={`diff-badge-${tier}`}>{tier}</span>
  ),
}));

jest.mock('@/components/landing/HomeRedirect', () => ({
  HomeRedirect: () => <div data-testid="home-redirect" />,
}));

jest.mock('@/components/landing/HeroButtons', () => ({
  HeroButtons: () => <div data-testid="hero-buttons" />,
}));

jest.mock('@/components/landing/FeatureCards', () => ({
  FeatureCards: () => <div data-testid="feature-cards" />,
}));

jest.mock('@/hooks/useInView', () => ({
  useInView: () => [{ current: null }, true],
}));

jest.mock('@/hooks/useAnimVal', () => ({
  useAnimVal: (target: number) => [{ current: null }, target],
}));

jest.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return { Sun: Icon, Moon: Icon };
});

describe('LandingPage', () => {
  it('랜딩 페이지가 렌더링된다', () => {
    render(<LandingPage />);
    expect(screen.getByText('알고리즘 스터디의')).toBeInTheDocument();
    expect(screen.getByText('새로운 기준')).toBeInTheDocument();
  });

  it('네비게이션에 로고와 시작하기 링크가 표시된다', () => {
    render(<LandingPage />);
    const navLink = screen.getByRole('link', { name: /AlgoSu/ });
    expect(navLink).toBeInTheDocument();
    expect(screen.getByText('시작하기')).toBeInTheDocument();
  });

  it('테마 전환 버튼이 존재한다', () => {
    render(<LandingPage />);
    expect(screen.getByRole('button', { name: '테마 전환' })).toBeInTheDocument();
  });

  it('난이도 뱃지들이 표시된다', () => {
    render(<LandingPage />);
    expect(screen.getByTestId('diff-badge-bronze')).toBeInTheDocument();
    expect(screen.getByTestId('diff-badge-diamond')).toBeInTheDocument();
  });

  it('HomeRedirect 컴포넌트가 렌더링된다', () => {
    render(<LandingPage />);
    expect(screen.getByTestId('home-redirect')).toBeInTheDocument();
  });

  it('FeatureCards 컴포넌트가 렌더링된다', () => {
    render(<LandingPage />);
    expect(screen.getByTestId('feature-cards')).toBeInTheDocument();
  });

  it('카운터 통계가 표시된다', () => {
    render(<LandingPage />);
    expect(screen.getByText('풀이 제출')).toBeInTheDocument();
    expect(screen.getByText('활성 스터디')).toBeInTheDocument();
    expect(screen.getByText('만족도')).toBeInTheDocument();
  });

  it('3단계 사용 방법이 표시된다', () => {
    render(<LandingPage />);
    expect(screen.getByText('스터디 생성')).toBeInTheDocument();
    expect(screen.getByText('문제 풀이 & 제출')).toBeInTheDocument();
    expect(screen.getByText('AI 리뷰 & 성장')).toBeInTheDocument();
  });

  it('오픈 스터디 목록이 표시된다', () => {
    render(<LandingPage />);
    expect(screen.getByText('알고리즘 마스터')).toBeInTheDocument();
    expect(screen.getByText('PS 스터디')).toBeInTheDocument();
    expect(screen.getByText('코딩테스트 준비반')).toBeInTheDocument();
  });

  it('최하단 CTA 섹션이 표시된다', () => {
    render(<LandingPage />);
    expect(screen.getByText('지금 바로 시작하세요')).toBeInTheDocument();
    expect(screen.getByText('무료로 시작하기')).toBeInTheDocument();
  });

  it('푸터가 표시된다', () => {
    render(<LandingPage />);
    expect(screen.getByText(/All rights reserved/)).toBeInTheDocument();
  });
});
