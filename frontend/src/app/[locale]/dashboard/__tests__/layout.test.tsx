import { render, screen } from '@testing-library/react';
import DashboardLayout, { metadata } from '../layout';

describe('DashboardLayout', () => {
  it('children을 그대로 렌더링한다', () => {
    render(
      <DashboardLayout>
        <div data-testid="child">Dashboard Content</div>
      </DashboardLayout>,
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
  });

  it('metadata.title이 "대시보드"이다', () => {
    expect(metadata.title).toBe('대시보드');
  });

  it('metadata.description이 올바르다', () => {
    expect(metadata.description).toBe('학습 현황과 통계를 확인하세요.');
  });
});
