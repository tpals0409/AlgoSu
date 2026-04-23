import { render, screen } from '@testing-library/react';
import ProblemsLoading from '../loading';

jest.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-layout">{children}</div>
  ),
}));

jest.mock('@/components/ui/Skeleton', () => ({
  SkeletonListPage: ({ rows }: { rows?: number }) => (
    <div data-testid="skeleton-list-page" aria-busy="true" data-rows={rows} />
  ),
}));

describe('ProblemsLoading', () => {
  it('스켈레톤 목록 페이지가 렌더링된다', () => {
    render(<ProblemsLoading />);
    expect(screen.getByTestId('skeleton-list-page')).toBeInTheDocument();
  });

  it('AppLayout 안에 렌더링된다', () => {
    render(<ProblemsLoading />);
    expect(screen.getByTestId('app-layout')).toBeInTheDocument();
  });

  it('rows=8 로 렌더링된다', () => {
    render(<ProblemsLoading />);
    expect(screen.getByTestId('skeleton-list-page')).toHaveAttribute('data-rows', '8');
  });
});
