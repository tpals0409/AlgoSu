import { render, screen } from '@testing-library/react';
import DashboardLoading from '../loading';

jest.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-layout">{children}</div>
  ),
}));

jest.mock('@/components/ui/Skeleton', () => ({
  SkeletonDashboard: () => <div data-testid="skeleton-dashboard" aria-busy="true" />,
}));

describe('DashboardLoading', () => {
  it('스켈레톤 대시보드가 렌더링된다', () => {
    render(<DashboardLoading />);
    expect(screen.getByTestId('skeleton-dashboard')).toBeInTheDocument();
  });

  it('AppLayout 안에 렌더링된다', () => {
    render(<DashboardLoading />);
    expect(screen.getByTestId('app-layout')).toBeInTheDocument();
  });
});
