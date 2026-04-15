import { render, screen } from '@testing-library/react';
import { LegalLayout } from '../LegalLayout';

describe('LegalLayout', () => {
  it('children과 nav/footer가 렌더링된다', () => {
    render(
      <LegalLayout>
        <p>테스트 콘텐츠</p>
      </LegalLayout>,
    );

    expect(screen.getByText('AlgoSu')).toBeInTheDocument();
    expect(screen.getByText('테스트 콘텐츠')).toBeInTheDocument();
    expect(screen.getAllByText(/개인정보처리방침/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/이용약관/).length).toBeGreaterThanOrEqual(1);
  });

  it('privacy/terms 링크가 존재한다', () => {
    render(
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
