import { render, screen } from '@testing-library/react';
import StudiesLayout, { metadata } from '../layout';

describe('StudiesLayout', () => {
  it('children을 그대로 렌더링한다', () => {
    render(
      <StudiesLayout>
        <div data-testid="child">Studies Content</div>
      </StudiesLayout>,
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByText('Studies Content')).toBeInTheDocument();
  });

  it('metadata.title이 "스터디"이다', () => {
    expect(metadata.title).toBe('스터디');
  });

  it('metadata.description이 올바르다', () => {
    expect(metadata.description).toBe('스터디 그룹을 관리하세요.');
  });
});
