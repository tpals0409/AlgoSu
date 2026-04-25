/**
 * @file LanguageSwitcher 단위 테스트
 * @domain common
 * @layer test
 * @related LanguageSwitcher, @/i18n/navigation
 */

import { Suspense } from 'react';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/i18n';
import { LanguageSwitcher } from '../LanguageSwitcher';

const mockReplace = jest.fn();
let mockSearchParams = new URLSearchParams();

jest.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
  usePathname: () => '/dashboard',
  Link: ({ children, href, ...rest }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
  redirect: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  ...jest.requireActual('next/navigation'),
  useSearchParams: () => mockSearchParams,
}));

jest.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => (args.filter(Boolean) as string[]).join(' '),
}));

describe('LanguageSwitcher', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = new URLSearchParams();
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

  it('쿼리 파라미터가 있으면 locale 전환 시 보존된다 (?page=2)', () => {
    mockSearchParams = new URLSearchParams('page=2');
    renderWithI18n(<LanguageSwitcher />);
    fireEvent.click(screen.getByText('EN'));
    expect(mockReplace).toHaveBeenCalledWith('/dashboard?page=2', { locale: 'en' });
  });

  it('복수 쿼리 파라미터도 보존된다 (?page=2&sort=asc)', () => {
    mockSearchParams = new URLSearchParams('page=2&sort=asc');
    renderWithI18n(<LanguageSwitcher />);
    fireEvent.click(screen.getByText('EN'));
    expect(mockReplace).toHaveBeenCalledWith('/dashboard?page=2&sort=asc', { locale: 'en' });
  });

  it('쿼리 파라미터가 없으면 경로만 전달된다', () => {
    mockSearchParams = new URLSearchParams();
    renderWithI18n(<LanguageSwitcher />);
    fireEvent.click(screen.getByText('EN'));
    expect(mockReplace).toHaveBeenCalledWith('/dashboard', { locale: 'en' });
  });
});

/**
 * H1 fix 회귀 테스트 —
 * LanguageSwitcher는 useSearchParams를 사용하므로 SSR 단계에서
 * Suspense 경계 없이 렌더되면 Next.js 경고가 발생한다.
 * 각 마운트 포인트(AppLayout, AuthShell, LandingContent)에서
 * <Suspense fallback={null}> 로 감싼 것을 검증한다.
 */
describe('LanguageSwitcher — Suspense 경계 (H1)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    Object.defineProperty(document, 'cookie', {
      writable: true,
      value: '',
    });
  });

  it('Suspense fallback={null}로 감싸진 상태에서 정상 렌더된다', () => {
    renderWithI18n(
      <Suspense fallback={null}>
        <LanguageSwitcher />
      </Suspense>,
    );
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
    expect(screen.getByText('KO')).toBeInTheDocument();
    expect(screen.getByText('EN')).toBeInTheDocument();
  });

  it('Suspense 내부에서도 locale 전환 클릭이 동작한다', () => {
    renderWithI18n(
      <Suspense fallback={null}>
        <LanguageSwitcher />
      </Suspense>,
    );
    fireEvent.click(screen.getByText('EN'));
    expect(mockReplace).toHaveBeenCalledWith('/dashboard', { locale: 'en' });
  });

  /**
   * Phase 1 보고서 4-2 누락 케이스 —
   * 영어 로케일 초기 상태에서 KO 클릭 시 한국어로 전환.
   * 영어 로케일에서 EN 버튼이 활성화되고 KO 클릭이 replace를 호출해야 한다.
   */
  it('영어 로케일 기준 KO 클릭 시 router.replace(/dashboard, { locale: ko }) 호출', () => {
    // locale: 'en' 으로 렌더 → useLocale() === 'en' → EN이 active, KO는 inactive
    renderWithI18n(<LanguageSwitcher />, { locale: 'en' });
    // EN이 활성 상태인지 확인
    expect(screen.getByText('EN')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('KO')).toHaveAttribute('aria-checked', 'false');
    // KO 클릭 → locale: ko 로 전환 요청
    fireEvent.click(screen.getByText('KO'));
    expect(mockReplace).toHaveBeenCalledWith('/dashboard', { locale: 'ko' });
  });

  it('영어 로케일에서 KO 클릭 시 NEXT_LOCALE=ko 쿠키가 설정된다', () => {
    renderWithI18n(<LanguageSwitcher />, { locale: 'en' });
    fireEvent.click(screen.getByText('KO'));
    expect(document.cookie).toContain('NEXT_LOCALE=ko');
    expect(document.cookie).toContain('SameSite=Lax');
  });
});
