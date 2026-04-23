/**
 * @file AuthLayout 통합 테스트 — AuthShell 래핑 구조 검증
 * @domain identity
 * @layer test
 * @related AuthShell, LanguageSwitcher, layout.tsx
 */

import { screen } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/i18n';
import AuthLayout from '../layout';

/** params mock — locale 'ko' 기본 */
const mockParams = Promise.resolve({ locale: 'ko' });

jest.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn() }),
  usePathname: () => '/',
  Link: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  redirect: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  ...jest.requireActual('next/navigation'),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ locale: 'ko' }),
}));

jest.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => (args.filter(Boolean) as string[]).join(' '),
}));

describe('AuthLayout', () => {
  it('children이 렌더링된다', () => {
    renderWithI18n(
      <AuthLayout params={mockParams}>
        <div data-testid="child">Child Content</div>
      </AuthLayout>,
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByText('Child Content')).toBeInTheDocument();
  });

  it('AuthShell로 감싸서 헤더와 메인 영역을 렌더링한다', () => {
    const { container } = renderWithI18n(
      <AuthLayout params={mockParams}>
        <div>Test</div>
      </AuthLayout>,
    );
    // AuthShell: header(fixed) + main(pt-12) 구조
    expect(container.querySelector('header')).toBeInTheDocument();
    expect(container.querySelector('main')).toBeInTheDocument();
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('여러 children을 렌더링한다', () => {
    renderWithI18n(
      <AuthLayout params={mockParams}>
        <div data-testid="first">First</div>
        <div data-testid="second">Second</div>
      </AuthLayout>,
    );
    expect(screen.getByTestId('first')).toBeInTheDocument();
    expect(screen.getByTestId('second')).toBeInTheDocument();
  });
});
