import { render, screen } from '@testing-library/react';
import SubmissionStatusLoading from '../loading';

jest.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-layout">{children}</div>
  ),
}));

jest.mock('@/components/ui/Skeleton', () => ({
  Skeleton: ({ width, height, className }: { width?: string | number; height?: number; className?: string }) => (
    <div data-testid="skeleton" data-width={width} data-height={height} className={className} />
  ),
  SkeletonCard: () => <div data-testid="skeleton-card" />,
}));

describe('SubmissionStatusLoading', () => {
  it('로딩 컨테이너가 렌더링된다', () => {
    render(<SubmissionStatusLoading />);
    const container = screen.getByLabelText('제출 상태 로딩 중');
    expect(container).toBeInTheDocument();
  });

  it('aria-busy 속성이 설정된다', () => {
    render(<SubmissionStatusLoading />);
    expect(screen.getByLabelText('제출 상태 로딩 중')).toHaveAttribute('aria-busy', 'true');
  });

  it('AppLayout 안에 렌더링된다', () => {
    render(<SubmissionStatusLoading />);
    expect(screen.getByTestId('app-layout')).toBeInTheDocument();
  });

  it('스켈레톤 카드들이 렌더링된다', () => {
    render(<SubmissionStatusLoading />);
    const skeletonCards = screen.getAllByTestId('skeleton-card');
    expect(skeletonCards.length).toBeGreaterThan(0);
  });
});
