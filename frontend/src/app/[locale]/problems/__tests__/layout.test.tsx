import { render, screen } from '@testing-library/react';
import ProblemsLayout, { metadata } from '../layout';

describe('ProblemsLayout', () => {
  it('children을 그대로 렌더링한다', () => {
    render(
      <ProblemsLayout>
        <div data-testid="child">Problems Content</div>
      </ProblemsLayout>,
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByText('Problems Content')).toBeInTheDocument();
  });

  it('metadata.title이 "문제 목록"이다', () => {
    expect(metadata.title).toBe('문제 목록');
  });

  it('metadata.description이 올바르다', () => {
    expect(metadata.description).toBe('알고리즘 문제를 풀어보세요.');
  });
});
