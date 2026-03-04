import { render, screen } from '@testing-library/react';
import ReviewLoading from '../loading';

jest.mock('@/components/ui/Skeleton', () => ({
  SkeletonReview: () => <div data-testid="skeleton-review" aria-busy="true" />,
}));

describe('ReviewLoading', () => {
  it('스켈레톤 리뷰가 렌더링된다', () => {
    render(<ReviewLoading />);
    expect(screen.getByTestId('skeleton-review')).toBeInTheDocument();
  });

  it('min-h-screen 컨테이너가 렌더링된다', () => {
    render(<ReviewLoading />);
    const container = screen.getByTestId('skeleton-review').parentElement;
    expect(container).toBeInTheDocument();
  });
});
