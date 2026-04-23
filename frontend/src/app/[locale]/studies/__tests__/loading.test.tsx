import { render, screen } from '@testing-library/react';
import StudiesLoading from '../loading';

jest.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-layout">{children}</div>
  ),
}));

jest.mock('@/components/ui/Skeleton', () => ({
  SkeletonCard: () => <div data-testid="skeleton-card" />,
}));

describe('StudiesLoading', () => {
  it('로딩 컨테이너가 렌더링된다', () => {
    render(<StudiesLoading />);
    const container = screen.getByLabelText('스터디 로딩 중');
    expect(container).toBeInTheDocument();
  });

  it('aria-busy 속성이 설정된다', () => {
    render(<StudiesLoading />);
    expect(screen.getByLabelText('스터디 로딩 중')).toHaveAttribute('aria-busy', 'true');
  });

  it('AppLayout 안에 렌더링된다', () => {
    render(<StudiesLoading />);
    expect(screen.getByTestId('app-layout')).toBeInTheDocument();
  });

  it('6개의 스켈레톤 카드가 렌더링된다', () => {
    render(<StudiesLoading />);
    const skeletonCards = screen.getAllByTestId('skeleton-card');
    expect(skeletonCards).toHaveLength(6);
  });
});
