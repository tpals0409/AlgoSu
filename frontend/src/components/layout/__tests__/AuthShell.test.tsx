/**
 * @file AuthShell 단위 테스트
 * @domain common
 * @layer test
 * @related AuthShell, LanguageSwitcher, Logo
 */

import { screen } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/i18n';
import { AuthShell } from '../AuthShell';

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
}));

jest.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => (args.filter(Boolean) as string[]).join(' '),
}));

describe('AuthShell', () => {
  it('Logo가 렌더링된다', () => {
    renderWithI18n(
      <AuthShell>
        <div>test child</div>
      </AuthShell>,
    );
    expect(screen.getByRole('img', { name: 'AlgoSu' })).toBeInTheDocument();
  });

  it('LanguageSwitcher가 렌더링된다', () => {
    renderWithI18n(
      <AuthShell>
        <div>test child</div>
      </AuthShell>,
    );
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
  });

  it('children이 렌더링된다', () => {
    renderWithI18n(
      <AuthShell>
        <div data-testid="child-content">로그인 폼</div>
      </AuthShell>,
    );
    expect(screen.getByTestId('child-content')).toBeInTheDocument();
    expect(screen.getByText('로그인 폼')).toBeInTheDocument();
  });
});
