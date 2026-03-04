import { render, screen } from '@testing-library/react';
import AuthLayout from '../layout';

describe('AuthLayout', () => {
  it('children이 렌더링된다', () => {
    render(
      <AuthLayout>
        <div data-testid="child">Child Content</div>
      </AuthLayout>,
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByText('Child Content')).toBeInTheDocument();
  });

  it('AlgoSu 브랜드 로고가 표시된다', () => {
    render(
      <AuthLayout>
        <div>Test</div>
      </AuthLayout>,
    );
    expect(screen.getByRole('heading', { name: 'AlgoSu' })).toBeInTheDocument();
  });

  it('서브타이틀이 표시된다', () => {
    render(
      <AuthLayout>
        <div>Test</div>
      </AuthLayout>,
    );
    expect(screen.getByText('알고리즘 스터디 플랫폼')).toBeInTheDocument();
  });

  it('중앙 정렬 레이아웃 구조를 가진다', () => {
    const { container } = render(
      <AuthLayout>
        <div>Test</div>
      </AuthLayout>,
    );
    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv).toHaveClass('flex', 'min-h-screen', 'items-center', 'justify-center');
  });

  it('children 컨테이너가 max-w-md 제한을 가진다', () => {
    render(
      <AuthLayout>
        <div data-testid="child">Test</div>
      </AuthLayout>,
    );
    const childWrapper = screen.getByTestId('child').parentElement;
    expect(childWrapper).toHaveClass('w-full', 'max-w-md');
  });

  it('브랜드 도트 장식이 aria-hidden이다', () => {
    const { container } = render(
      <AuthLayout>
        <div>Test</div>
      </AuthLayout>,
    );
    const dot = container.querySelector('[aria-hidden]');
    expect(dot).toBeInTheDocument();
    expect(dot).toHaveClass('rounded-full', 'bg-primary');
  });
});
