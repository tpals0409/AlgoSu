/**
 * @file LanguageSwitcher 단위 테스트
 * @domain common
 * @layer test
 * @related LanguageSwitcher, @/i18n/navigation
 */

import { screen, fireEvent } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/i18n';
import { LanguageSwitcher } from '../LanguageSwitcher';

const mockReplace = jest.fn();

jest.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
  usePathname: () => '/dashboard',
  Link: ({ children, href, ...rest }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
  redirect: jest.fn(),
}));

jest.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => (args.filter(Boolean) as string[]).join(' '),
}));

describe('LanguageSwitcher', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(document, 'cookie', {
      writable: true,
      value: '',
    });
  });

  it('언어 스위처 radiogroup이 렌더링된다', () => {
    renderWithI18n(<LanguageSwitcher />);
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
    expect(screen.getByText('KO')).toBeInTheDocument();
    expect(screen.getByText('EN')).toBeInTheDocument();
  });

  it('현재 locale(ko)이 활성 상태로 표시된다', () => {
    renderWithI18n(<LanguageSwitcher />);
    const koButton = screen.getByText('KO');
    expect(koButton).toHaveAttribute('aria-checked', 'true');
  });

  it('비활성 locale(en)은 aria-checked=false이다', () => {
    renderWithI18n(<LanguageSwitcher />);
    const enButton = screen.getByText('EN');
    expect(enButton).toHaveAttribute('aria-checked', 'false');
  });

  it('EN 클릭 시 router.replace가 locale: en으로 호출된다', () => {
    renderWithI18n(<LanguageSwitcher />);
    fireEvent.click(screen.getByText('EN'));
    expect(mockReplace).toHaveBeenCalledWith('/dashboard', { locale: 'en' });
  });

  it('EN 클릭 시 NEXT_LOCALE 쿠키가 설정된다', () => {
    renderWithI18n(<LanguageSwitcher />);
    fireEvent.click(screen.getByText('EN'));
    expect(document.cookie).toContain('NEXT_LOCALE=en');
    expect(document.cookie).toContain('SameSite=Lax');
  });

  it('이미 활성된 locale(KO) 클릭 시 router.replace가 호출되지 않는다', () => {
    renderWithI18n(<LanguageSwitcher />);
    fireEvent.click(screen.getByText('KO'));
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('접근성: radiogroup에 aria-label이 설정된다', () => {
    renderWithI18n(<LanguageSwitcher />);
    const group = screen.getByRole('radiogroup');
    expect(group).toHaveAttribute('aria-label', '언어 전환');
  });

  it('접근성: 각 버튼에 aria-label이 설정된다', () => {
    renderWithI18n(<LanguageSwitcher />);
    expect(screen.getByRole('radio', { name: '한국어' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'English' })).toBeInTheDocument();
  });

  it('활성 locale에 aria-current="true"가 설정된다', () => {
    renderWithI18n(<LanguageSwitcher />);
    const koButton = screen.getByText('KO');
    expect(koButton).toHaveAttribute('aria-current', 'true');
  });

  it('비활성 locale에 aria-current가 설정되지 않는다', () => {
    renderWithI18n(<LanguageSwitcher />);
    const enButton = screen.getByText('EN');
    expect(enButton).not.toHaveAttribute('aria-current');
  });
});
