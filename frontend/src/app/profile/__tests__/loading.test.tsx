import { render, screen } from '@testing-library/react';
import ProfileLoading from '../loading';

jest.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-layout">{children}</div>
  ),
}));

jest.mock('@/components/ui/Skeleton', () => ({
  SkeletonProfile: () => <div data-testid="skeleton-profile" aria-busy="true" />,
}));

describe('ProfileLoading', () => {
  it('스켈레톤 프로필이 렌더링된다', () => {
    render(<ProfileLoading />);
    expect(screen.getByTestId('skeleton-profile')).toBeInTheDocument();
  });

  it('AppLayout 안에 렌더링된다', () => {
    render(<ProfileLoading />);
    expect(screen.getByTestId('app-layout')).toBeInTheDocument();
  });
});
