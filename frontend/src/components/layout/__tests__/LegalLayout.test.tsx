/**
 * @file LegalLayout Server Component 테스트
 * @domain common
 * @layer test
 * @related LegalLayout.tsx
 *
 * Server Component(async)이므로 renderWithI18n(Client Provider) 대신
 * next-intl/server를 mock하고 await로 JSX를 얻어 render한다.
 * Sprint 122 not-found Server Component 전환 패턴 준용.
 */

import { render, screen } from '@testing-library/react';
import { LegalLayout } from '../LegalLayout';

jest.mock('@/components/layout/LanguageSwitcher', () => ({
  LanguageSwitcher: () => <div data-testid="language-switcher">LangSwitch</div>,
}));

jest.mock('next-intl/server', () => ({
  getTranslations: () =>
    Promise.resolve((key: string) => {
      const translations: Record<string, string> = {
        'legalLayout.privacy': '개인정보처리방침',
        'legalLayout.terms': '이용약관',
      };
      return translations[key] ?? key;
    }),
}));

describe('LegalLayout', () => {
  it('renders children with nav and footer', async () => {
    const jsx = await LegalLayout({ children: <p>Test content</p> });
    render(<>{jsx}</>);

    expect(screen.getByText('AlgoSu')).toBeInTheDocument();
    expect(screen.getByText('Test content')).toBeInTheDocument();
    expect(screen.getAllByText(/개인정보처리방침/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/이용약관/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders LanguageSwitcher in nav', async () => {
    const jsx = await LegalLayout({ children: <div /> });
    render(<>{jsx}</>);

    expect(screen.getByTestId('language-switcher')).toBeInTheDocument();
  });

  it('has privacy/terms links', async () => {
    const jsx = await LegalLayout({ children: <div /> });
    render(<>{jsx}</>);

    const privacyLinks = screen.getAllByRole('link', { name: /개인정보처리방침/ });
    const termsLinks = screen.getAllByRole('link', { name: /이용약관/ });
    expect(privacyLinks[0]).toHaveAttribute('href', '/privacy');
    expect(termsLinks[0]).toHaveAttribute('href', '/terms');
  });
});
