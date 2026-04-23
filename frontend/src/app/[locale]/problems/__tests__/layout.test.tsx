import { render, screen } from '@testing-library/react';
import ProblemsLayout from '../layout';

describe('ProblemsLayout', () => {
  it('children을 그대로 렌더링한다', () => {
    const params = Promise.resolve({ locale: 'ko' });
    render(
      <ProblemsLayout params={params}>
        <div data-testid="child">Problems Content</div>
      </ProblemsLayout>,
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByText('Problems Content')).toBeInTheDocument();
  });
});
