import { screen } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/i18n';
import { LegalLayout } from '../LegalLayout';

describe('LegalLayout', () => {
  it('renders children with nav and footer', () => {
    renderWithI18n(
      <LegalLayout>
        <p>Test content</p>
      </LegalLayout>,
    );

    expect(screen.getByText('AlgoSu')).toBeInTheDocument();
    expect(screen.getByText('Test content')).toBeInTheDocument();
    expect(screen.getAllByText(/개인정보처리방침/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/이용약관/).length).toBeGreaterThanOrEqual(1);
  });

  it('has privacy/terms links', () => {
    renderWithI18n(
      <LegalLayout>
        <div />
      </LegalLayout>,
    );

    const privacyLinks = screen.getAllByRole('link', { name: /개인정보처리방침/ });
    const termsLinks = screen.getAllByRole('link', { name: /이용약관/ });
    expect(privacyLinks[0]).toHaveAttribute('href', '/privacy');
    expect(termsLinks[0]).toHaveAttribute('href', '/terms');
  });
});
