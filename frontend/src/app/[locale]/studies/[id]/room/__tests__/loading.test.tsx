import { render, screen } from '@testing-library/react';
import StudyRoomLoading from '../loading';

jest.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-layout">{children}</div>
  ),
}));

jest.mock('@/components/ui/Skeleton', () => ({
  Skeleton: ({ width, height, className }: { width?: string | number; height?: number; className?: string }) => (
    <div data-testid="skeleton" data-width={width} data-height={height} className={className} />
  ),
  SkeletonListPage: ({ rows }: { rows?: number }) => (
    <div data-testid="skeleton-list-page" data-rows={rows} />
  ),
}));

describe('StudyRoomLoading', () => {
  it('로딩 컨테이너가 렌더링된다', () => {
    render(<StudyRoomLoading />);
    const container = screen.getByLabelText('스터디 룸 로딩 중');
    expect(container).toBeInTheDocument();
  });

  it('aria-busy 속성이 설정된다', () => {
    render(<StudyRoomLoading />);
    expect(screen.getByLabelText('스터디 룸 로딩 중')).toHaveAttribute('aria-busy', 'true');
  });

  it('AppLayout 안에 렌더링된다', () => {
    render(<StudyRoomLoading />);
    expect(screen.getByTestId('app-layout')).toBeInTheDocument();
  });

  it('스켈레톤 목록 페이지가 렌더링된다', () => {
    render(<StudyRoomLoading />);
    expect(screen.getByTestId('skeleton-list-page')).toBeInTheDocument();
  });
});
