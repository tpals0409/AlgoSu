import { screen } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/i18n';
import { LandingContent } from '@/components/landing/LandingContent';

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

jest.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return { Sun: Icon, Moon: Icon };
});

jest.mock('@/components/ad/AdBanner', () => ({
  AdBanner: () => <div data-testid="ad-banner" />,
}));

describe('LandingPage (LandingContent)', () => {
  it('랜딩 페이지가 렌더링된다', () => {
    renderWithI18n(<LandingContent />);
    expect(screen.getByText('알고리즘 스터디의')).toBeInTheDocument();
    expect(screen.getByText('새로운 기준')).toBeInTheDocument();
  });

  it('네비게이션에 로고와 시작하기 링크가 표시된다', () => {
    renderWithI18n(<LandingContent />);
    const navLink = screen.getByRole('link', { name: /AlgoSu/ });
    expect(navLink).toBeInTheDocument();
    expect(screen.getByText('시작하기')).toBeInTheDocument();
  });

  it('테마 전환 버튼이 존재한다', () => {
    renderWithI18n(<LandingContent />);
    expect(screen.getByRole('button', { name: '테마 전환' })).toBeInTheDocument();
  });

  it('HomeRedirect 컴포넌트가 렌더링된다', () => {
    renderWithI18n(<LandingContent />);
    expect(screen.getByTestId('home-redirect')).toBeInTheDocument();
  });

  it('FeatureCards 컴포넌트가 렌더링된다', () => {
    renderWithI18n(<LandingContent />);
    expect(screen.getByTestId('feature-cards')).toBeInTheDocument();
  });

  it('사용자 후기 섹션이 표시된다', () => {
    renderWithI18n(<LandingContent />);
    expect(screen.getByText('사용자 후기')).toBeInTheDocument();
    expect(screen.getByText('이서연')).toBeInTheDocument();
    expect(screen.getByText('박준서')).toBeInTheDocument();
    expect(screen.getByText('최예린')).toBeInTheDocument();
  });

  it('최하단 CTA 섹션이 표시된다', () => {
    renderWithI18n(<LandingContent />);
    expect(screen.getByText('지금 바로 시작하세요')).toBeInTheDocument();
  });

  it('푸터가 표시된다', () => {
    renderWithI18n(<LandingContent />);
    expect(screen.getByText(/All rights reserved/)).toBeInTheDocument();
  });

  it('시작하기 링크가 표시된다', () => {
    renderWithI18n(<LandingContent />);
    expect(screen.getByText('시작하기')).toBeInTheDocument();
  });

  it('서브타이틀이 표시된다', () => {
    renderWithI18n(<LandingContent />);
    expect(screen.getByText(/문제 풀이부터 GitHub 동기화/)).toBeInTheDocument();
  });
});
