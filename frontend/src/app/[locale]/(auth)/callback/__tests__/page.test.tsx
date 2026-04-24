/**
 * @file CallbackPage 단위 테스트 — OAuth 에러 코드 화이트리스트 + i18n 메시지 매핑
 * @domain identity
 * @layer test
 * @related callback/page.tsx, messages/ko/auth.json
 *
 * Sprint 126 Wave B5+B6:
 * - 4개 누락 에러 코드(access_denied, missing_params, auth_failed, invalid_state) 추가
 * - 하드코딩된 ko-KR 문자열 → auth.json 메시지 source 직접 참조로 교체
 */

import { screen } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/i18n';
import koAuth from '../../../../../../messages/ko/auth.json';
import CallbackPage from '../page';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useSearchParams: () => ({ get: () => null }),
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: false,
    isLoading: false,
    user: null,
    logout: jest.fn(),
    loginFromCookie: jest.fn(),
    updateGitHubStatus: jest.fn(),
  }),
}));

jest.mock('@/components/ui/LoadingSpinner', () => ({
  LoadingSpinner: () => <div data-testid="loading-spinner" />,
  InlineSpinner: () => <span data-testid="inline-spinner" />,
}));

jest.mock('@/components/ui/Alert', () => ({
  Alert: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="alert">{children}</div>
  ),
}));

jest.mock('@/components/ui/Card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/ui/Button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

jest.mock('@/lib/api', () => ({
  authApi: {
    linkGitHub: jest.fn(),
  },
}));

jest.mock('@/i18n/navigation', () => {
  const MockLink = ({ children, href, ...rest }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  );
  MockLink.displayName = 'MockLink';
  return {
    Link: MockLink,
    redirect: jest.fn(),
    usePathname: () => '/callback',
    useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  };
});

// Sprint 125 Wave C ADR-025: ALLOWED_ERRORS 7종 — 화이트리스트 검증 대상
// 테스트 메시지는 messages/ko/auth.json을 단일 진실 원천으로 참조한다 (하드코딩 회피).
type AuthErrorCode =
  | 'access_denied'
  | 'missing_params'
  | 'auth_failed'
  | 'invalid_state'
  | 'token_exchange'
  | 'profile_fetch'
  | 'account_conflict';

const ALLOWED_ERRORS: readonly AuthErrorCode[] = [
  'access_denied',
  'missing_params',
  'auth_failed',
  'invalid_state',
  'token_exchange',
  'profile_fetch',
  'account_conflict',
] as const;

describe('CallbackPage', () => {
  afterEach(() => {
    window.location.hash = '';
  });

  it('콜백 페이지가 렌더링된다 (loading 상태)', () => {
    renderWithI18n(<CallbackPage />);
    expect(screen.getAllByText(koAuth.callback.loading).length).toBeGreaterThanOrEqual(1);
  });

  it('로딩 스피너가 표시된다', () => {
    renderWithI18n(<CallbackPage />);
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  // ── ALLOWED_ERRORS 7종 전수 커버리지 (Sprint 126 B5) ──
  describe.each(ALLOWED_ERRORS)('error=%s', (code) => {
    it(`#error=${code} 시 매핑된 i18n 메시지를 표시한다`, () => {
      window.location.hash = `#error=${code}`;
      renderWithI18n(<CallbackPage />);
      const expected = koAuth.callback.error[code];
      expect(screen.getByText(expected)).toBeInTheDocument();
    });
  });

  // ── 화이트리스트 외부 코드 → unknown 폴백 (피싱 방지) ──
  it('화이트리스트 외 코드는 unknown 메시지로 폴백한다', () => {
    window.location.hash = '#error=phishing_attempt';
    renderWithI18n(<CallbackPage />);
    expect(screen.getByText(koAuth.callback.error.unknown)).toBeInTheDocument();
  });
});
