import { render, screen } from '@testing-library/react';
import StudyCreateLoading from '../loading';

jest.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-layout">{children}</div>
  ),
}));

jest.mock('@/components/ui/Skeleton', () => ({
  Skeleton: ({ variant, width, height }: { variant?: string; width?: string | number; height?: number }) => (
    <div data-testid="skeleton" data-variant={variant} data-width={width} data-height={height} />
  ),
  SkeletonCard: () => <div data-testid="skeleton-card" />,
}));

describe('StudyCreateLoading', () => {
  it('로딩 컨테이너가 렌더링된다', () => {
    render(<StudyCreateLoading />);
    const container = screen.getByLabelText('스터디 생성 로딩 중');
    expect(container).toBeInTheDocument();
  });

  it('aria-busy 속성이 설정된다', () => {
    render(<StudyCreateLoading />);
    expect(screen.getByLabelText('스터디 생성 로딩 중')).toHaveAttribute('aria-busy', 'true');
  });

  it('AppLayout 안에 렌더링된다', () => {
    render(<StudyCreateLoading />);
    expect(screen.getByTestId('app-layout')).toBeInTheDocument();
  });

  it('스켈레톤 카드들이 렌더링된다', () => {
    render(<StudyCreateLoading />);
    const skeletonCards = screen.getAllByTestId('skeleton-card');
    expect(skeletonCards.length).toBeGreaterThan(0);
  });
});
