/**
 * @file GuestNav 단위 테스트
 * @domain guest
 * @layer test
 * @related GuestNav.tsx
 *
 * Client Component('use client')이므로 renderWithI18n으로 래핑.
 * LanguageSwitcher는 Suspense 내부이므로 mock 처리.
 */

import { screen } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/i18n';
import { GuestNav } from '../GuestNav';

jest.mock('@/components/layout/LanguageSwitcher', () => ({
  LanguageSwitcher: () => <div data-testid="language-switcher">LangSwitch</div>,
}));

jest.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light', setTheme: jest.fn() }),
}));

jest.mock('next/link', () => {
  const MockLink = ({
    children,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => <a {...props}>{children}</a>;
  MockLink.displayName = 'MockLink';
  return MockLink;
});

jest.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return { Sun: Icon, Moon: Icon };
});

jest.mock('@/components/ui/Logo', () => ({
  Logo: () => <svg data-testid="logo" />,
}));

jest.mock('@/lib/event-tracker', () => ({
  eventTracker: { track: jest.fn() },
}));

describe('GuestNav', () => {
  it('renders LanguageSwitcher', () => {
    renderWithI18n(<GuestNav />);

    expect(screen.getByTestId('language-switcher')).toBeInTheDocument();
  });

  it('renders Logo', () => {
    renderWithI18n(<GuestNav />);

    expect(screen.getByTestId('logo')).toBeInTheDocument();
  });

  it('renders ThemeToggle button', () => {
    renderWithI18n(<GuestNav />);

    expect(screen.getByRole('button', { name: /테마/i })).toBeInTheDocument();
  });

  it('renders signup CTA link', () => {
    renderWithI18n(<GuestNav />);

    const signupLink = screen.getByRole('link', { name: /가입|시작/i });
    expect(signupLink).toHaveAttribute('href', '/login');
  });
});
