/**
 * @file Login 페이지 (i18n 번역 적용)
 * @domain identity
 * @layer page
 * @related AuthContext, authApi, Logo, @/i18n/navigation
 *
 * useTranslations('auth') 훅으로 모든 UI 문자열을 번역 키로 참조한다.
 * locale-aware Link를 사용하여 /en 로케일에서도 올바른 경로 유지.
 */

'use client';

import { useState, useCallback, useEffect, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { Suspense } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Logo } from '@/components/ui/Logo';
import { Alert } from '@/components/ui/Alert';
import { InlineSpinner } from '@/components/ui/LoadingSpinner';
import { authApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { withLocalePrefix } from '@/lib/locale-path';

// ─── TYPES ────────────────────────────────

type OAuthProvider = 'google' | 'naver' | 'kakao';

// ─── CONSTANTS ────────────────────────────

/** OAuth 프로바이더별 스타일 설정 */
const PROVIDER_STYLES: Record<
  OAuthProvider,
  { icon: () => ReactNode; className: string; hoverClassName: string }
> = {
  google: {
    icon: GoogleIcon,
    className: 'border border-border bg-bg-card text-text',
    hoverClassName: 'hover:bg-bg-alt',
  },
  naver: {
    icon: NaverIcon,
    className: 'border-transparent bg-oauth-naver text-white',
    hoverClassName: 'hover:brightness-95',
  },
  kakao: {
    icon: KakaoIcon,
    className: 'border-transparent bg-oauth-kakao-bg text-oauth-kakao-text',
    hoverClassName: 'hover:brightness-95',
  },
};

/** 프로바이더 렌더링 순서 */
const PROVIDER_ORDER: OAuthProvider[] = ['google', 'naver', 'kakao'];

// ─── LOGIN CONTENT ───────────────────────

function LoginContent(): ReactNode {
  const t = useTranslations('auth');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading: authLoading, loginFromCookie } = useAuth();
  const { theme, setTheme } = useTheme();
  const [error, setError] = useState<string | null>(null);
  const [loadingProvider, setLoadingProvider] = useState<OAuthProvider | null>(null);
  const [demoLoading, setDemoLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showExpiredModal, setShowExpiredModal] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // bfcache 복원 시 로딩 상태 리셋 (OAuth 리다이렉트 후 뒤로가기 대응)
  useEffect(() => {
    const handlePageShow = (e: PageTransitionEvent): void => {
      if (e.persisted) {
        setLoadingProvider(null);
      }
    };
    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, []);

  // 이미 인증된 경우 대시보드로 리다이렉트
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace('/studies');
    }
  }, [authLoading, isAuthenticated, router]);

  // ESC 키로 세션 만료 모달 닫기
  useEffect(() => {
    if (!showExpiredModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowExpiredModal(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showExpiredModal]);

  // URL 파라미터 처리
  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam) {
      setError(t('errors.authFailed'));
    }
    const expiredParam = searchParams.get('expired');
    if (expiredParam === 'true') {
      setShowExpiredModal(true);
      window.history.replaceState({}, '', withLocalePrefix('/login'));
    }
  }, [searchParams, t]);

  /** 데모 로그인 핸들러 */
  const handleDemoLogin = useCallback(async () => {
    setError(null);
    setDemoLoading(true);
    try {
      const { redirect } = await authApi.demoLogin();
      loginFromCookie();
      router.push(redirect);
    } catch {
      setError(t('errors.demoFailed'));
      setDemoLoading(false);
    }
  }, [router, loginFromCookie, t]);

  /** OAuth 로그인 핸들러 */
  const handleOAuth = useCallback(async (provider: OAuthProvider) => {
    setError(null);
    setLoadingProvider(provider);
    try {
      const { url } = await authApi.getOAuthUrl(provider);
      window.location.href = url;
    } catch {
      setError(t('errors.serviceFailed'));
      setLoadingProvider(null);
    }
  }, [t]);

  /** fade-in 스타일 */
  const fade = (delay = 0): React.CSSProperties => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(20px)',
    transition: `opacity .6s cubic-bezier(.16,1,.3,1) ${delay}s, transform .6s cubic-bezier(.16,1,.3,1) ${delay}s`,
  });

  return (
    <div className="flex min-h-screen flex-col bg-bg text-text">
      {/* NAV */}
      <nav className="fixed inset-x-0 top-0 z-50 border-b border-border glass-nav">
        <div className="mx-auto flex h-14 max-w-container items-center justify-between px-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-base font-bold tracking-tight"
          >
            <Logo size={28} />
            AlgoSu
          </Link>
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="flex h-9 w-9 items-center justify-center rounded-btn text-text-3 hover:text-text hover:bg-bg-alt transition-colors"
            aria-label={t('login.themeToggle')}
          >
            {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>
        </div>
      </nav>

      {/* MAIN */}
      <main className="relative flex flex-1 items-center justify-center overflow-hidden px-6 pt-14">
        {/* 배경 glow */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'var(--hero-glow)' }}
        />

        <div className="relative w-full max-w-[360px]" style={fade(0)}>
          <div className="pt-10 pb-8 px-8">
            {/* 로고 + 제목 */}
            <div className="mb-8 text-center" style={fade(0.1)}>
              <div className="mx-auto mb-4 flex justify-center">
                <Logo size={48} />
              </div>
              <h1 className="mb-1.5 text-[26px] font-bold tracking-tight text-text leading-snug">
                {t('login.title')}<br />{t('login.titleLine2')}
              </h1>
              <p className="text-[13px] text-text-3">
                {t('login.subtitle')}
              </p>
            </div>

            {/* 에러 표시 */}
            {error && (
              <div className="mb-4">
                <Alert variant="error" onClose={() => setError(null)}>
                  {error}
                </Alert>
              </div>
            )}

            {/* OAuth 버튼 */}
            <div className="flex flex-col gap-2.5">
              {PROVIDER_ORDER.map((providerId, idx) => {
                const style = PROVIDER_STYLES[providerId];
                const isCurrentLoading = loadingProvider === providerId;
                const isDisabled = loadingProvider !== null;
                const Icon = style.icon;

                return (
                  <button
                    key={providerId}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => void handleOAuth(providerId)}
                    className={`flex h-12 w-full items-center justify-center gap-2.5 rounded-btn border text-sm font-medium transition-all disabled:opacity-50 ${style.className} ${style.hoverClassName}`}
                    style={fade(0.25 + idx * 0.08)}
                  >
                    {isCurrentLoading ? (
                      <InlineSpinner />
                    ) : (
                      <Icon />
                    )}
                    {isCurrentLoading
                      ? t('login.provider.connecting')
                      : t(`login.provider.${providerId}`)}
                  </button>
                );
              })}
            </div>

            {/* 데모 체험 버튼 */}
            {process.env.NEXT_PUBLIC_DEMO_ENABLED === 'true' && (
              <div style={fade(0.5)}>
                <div className="my-5 flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-[11px] text-text-3">{t('login.demo.divider')}</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <button
                  type="button"
                  disabled={demoLoading || loadingProvider !== null}
                  onClick={() => void handleDemoLogin()}
                  className="flex h-12 w-full items-center justify-center gap-2.5 rounded-btn border border-dashed border-primary/40 bg-primary/5 text-sm font-medium text-primary transition-all hover:bg-primary/10 disabled:opacity-50"
                >
                  {demoLoading ? <InlineSpinner /> : <DemoIcon />}
                  {demoLoading ? t('login.demo.loading') : t('login.demo.button')}
                </button>
                <p className="mt-2 text-center text-[11px] text-text-3">
                  {t('login.demo.description')}
                </p>
              </div>
            )}

            {/* 게스트 둘러보기 */}
            <p className="mt-4 text-center text-[11px] text-text-3" style={fade(0.55)}>
              {t('login.guest.prompt')}{' '}
              <Link
                href="/guest"
                className="underline transition-colors hover:text-text"
              >
                {t('login.guest.link')}
              </Link>
            </p>

            {/* 약관 */}
            <p
              className="mt-7 text-center text-[11px] leading-relaxed text-text-3"
              style={fade(0.45)}
            >
              {t('login.terms.prefix')}{' '}
              <Link href="/terms" className="underline transition-colors hover:text-text">
                {t('login.terms.termsLink')}
              </Link>{' '}
              {t('login.terms.conjunction')}{' '}
              <Link href="/privacy" className="underline transition-colors hover:text-text">
                {t('login.terms.privacyLink')}
              </Link>
              {t('login.terms.suffix')}
            </p>
          </div>
        </div>
      </main>

      {/* 세션 만료 모달 */}
      {showExpiredModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" role="presentation" onClick={() => setShowExpiredModal(false)} />
          <div className="relative rounded-xl border border-border bg-bg-card p-5 shadow-lg w-[340px] space-y-4">
            <p className="text-[14px] font-semibold text-text">{t('expired.title')}</p>
            <p className="text-[13px]" style={{ color: 'var(--text-2)' }}>{t('expired.description')}</p>
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowExpiredModal(false)}
                className="px-4 py-2 rounded-lg text-[13px] font-medium text-white transition-opacity"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                {t('expired.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="py-5 text-center">
        <div className="mb-2 flex items-center justify-center gap-4 text-[12px] font-medium text-text-3">
          <Link href="/privacy" className="transition-colors hover:text-text">
            {t('login.footer.privacy')}
          </Link>
          <span aria-hidden>·</span>
          <Link href="/terms" className="transition-colors hover:text-text">
            {t('login.footer.terms')}
          </Link>
        </div>
        <p className="text-[11px] text-text-3">
          &copy; {new Date().getFullYear()} AlgoSu. All rights reserved.
        </p>
      </footer>
    </div>
  );
}

// ─── RENDER ──────────────────────────────

export default function LoginPage(): ReactNode {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginContent />
    </Suspense>
  );
}

/** Suspense 폴백 */
function LoginFallback(): ReactNode {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg">
      <Logo size={48} />
    </div>
  );
}

// ─── ICONS ───────────────────────────────

function GoogleIcon(): ReactNode {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function NaverIcon(): ReactNode {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M13.56 10.7L6.17 1H1v18h5.44V9.3L13.83 19H19V1h-5.44v9.7z" fill="currentColor" />
    </svg>
  );
}

function DemoIcon(): ReactNode {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <polygon points="10 8 16 12 10 16 10 8" />
    </svg>
  );
}

function KakaoIcon(): ReactNode {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 3C6.48 3 2 6.36 2 10.44c0 2.62 1.75 4.93 4.38 6.24l-1.12 4.1c-.1.36.31.65.63.44l4.85-3.2c.42.04.84.06 1.26.06 5.52 0 10-3.36 10-7.5S17.52 3 12 3z"
        fill="#191919"
      />
    </svg>
  );
}
