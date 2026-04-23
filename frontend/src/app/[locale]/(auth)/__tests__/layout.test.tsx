import { render, screen } from '@testing-library/react';
import AuthLayout from '../layout';

/** params mock — locale 'ko' 기본 */
const mockParams = Promise.resolve({ locale: 'ko' });

describe('AuthLayout', () => {
  it('children이 렌더링된다', () => {
    render(
      <AuthLayout params={mockParams}>
        <div data-testid="child">Child Content</div>
      </AuthLayout>,
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByText('Child Content')).toBeInTheDocument();
  });

  it('children을 fragment로 감싸서 렌더링한다', () => {
    const { container } = render(
      <AuthLayout params={mockParams}>
        <div>Test</div>
      </AuthLayout>,
    );
    // Layout is now just <>{children}</>, so the child is directly rendered
    expect(container.querySelector('div')).toBeInTheDocument();
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('여러 children을 렌더링한다', () => {
    render(
      <AuthLayout params={mockParams}>
        <div data-testid="first">First</div>
        <div data-testid="second">Second</div>
      </AuthLayout>,
    );
    expect(screen.getByTestId('first')).toBeInTheDocument();
    expect(screen.getByTestId('second')).toBeInTheDocument();
  });
});
