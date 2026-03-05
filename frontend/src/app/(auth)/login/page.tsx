/**
 * @file Login 페이지 (v2 전면 교체)
 * @domain identity
 * @layer page
 * @related AuthContext, authApi, Logo
 */

'use client';

import { useState, useCallback, useEffect, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { Alert } from '@/components/ui/Alert';
import { InlineSpinner } from '@/components/ui/LoadingSpinner';
import { authApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

// ─── TYPES ────────────────────────────────

type OAuthProvider = 'google' | 'naver' | 'kakao';

// ─── CONSTANTS ────────────────────────────

const PROVIDERS: {
  id: OAuthProvider;
  label: string;
  icon: () => ReactNode;
  className: string;
  hoverClassName: string;
}[] = [
  {
    id: 'google',
    label: 'Google로 계속하기',
    icon: GoogleIcon,
    className: 'border border-border bg-bg-card text-text',
    hoverClassName: 'hover:bg-bg-alt',
  },
  {
    id: 'naver',
    label: 'Naver로 계속하기',
    icon: NaverIcon,
    className: 'border-transparent bg-oauth-naver text-white',
    hoverClassName: 'hover:brightness-95',
  },
  {
    id: 'kakao',
    label: 'Kakao로 계속하기',
    icon: KakaoIcon,
    className: 'border-transparent bg-oauth-kakao-bg text-oauth-kakao-text',
    hoverClassName: 'hover:brightness-95',
  },
];

// ─── LOGIN CONTENT ───────────────────────

function LoginContent(): ReactNode {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { theme, setTheme } = useTheme();
  const [error, setError] = useState<string | null>(null);
  const [loadingProvider, setLoadingProvider] = useState<OAuthProvider | null>(null);
  const [mounted, setMounted] = useState(false);

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

  // URL 에러 파라미터 처리
  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam) {
      setError('인증에 실패했습니다. 다시 시도해주세요.');
    }
  }, [searchParams]);

  /** OAuth 로그인 핸들러 */
  const handleOAuth = useCallback(async (provider: OAuthProvider) => {
    setError(null);
    setLoadingProvider(provider);
    try {
      const { url } = await authApi.getOAuthUrl(provider);
      window.location.href = url;
    } catch {
      setError('로그인 서비스에 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
      setLoadingProvider(null);
    }
  }, []);

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
            className="flex items-center gap-1 rounded-btn px-2 py-1 text-[11px] text-text-3 hover:text-text hover:bg-bg-alt transition-colors"
            aria-label="테마 전환"
          >
            {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            {theme === 'dark' ? '다크' : '라이트'}
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

        <div className="relative w-full max-w-[400px]" style={fade(0)}>
          {/* 로그인 카드 */}
          <div className="rounded-card border border-border bg-bg-card pt-10 pb-8 px-8 shadow">
            {/* 로고 + 제목 */}
            <div className="mb-8 text-center" style={fade(0.1)}>
              <div className="mx-auto mb-4 flex justify-center">
                <Logo size={48} />
              </div>
              <h1 className="mb-1.5 text-[22px] font-bold tracking-tight text-text">
                AlgoSu에 로그인
              </h1>
              <p className="text-[13px] text-text-3">
                알고리즘 스터디 플랫폼
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
              {PROVIDERS.map((provider, idx) => {
                const isCurrentLoading = loadingProvider === provider.id;
                const isDisabled = loadingProvider !== null;
                const Icon = provider.icon;

                return (
                  <button
                    key={provider.id}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => void handleOAuth(provider.id)}
                    className={`flex h-12 w-full items-center justify-center gap-2.5 rounded-md border text-sm font-medium transition-all disabled:opacity-50 ${provider.className} ${provider.hoverClassName}`}
                    style={fade(0.25 + idx * 0.08)}
                  >
                    {isCurrentLoading ? (
                      <InlineSpinner />
                    ) : (
                      <Icon />
                    )}
                    {isCurrentLoading ? '연결 중...' : provider.label}
                  </button>
                );
              })}
            </div>

            {/* 약관 */}
            <p
              className="mt-7 text-center text-[11px] leading-relaxed text-text-3"
              style={fade(0.45)}
            >
              로그인 시{' '}
              <span className="cursor-pointer text-primary">서비스 약관</span> 및{' '}
              <span className="cursor-pointer text-primary">개인정보 처리방침</span>에 동의합니다.
            </p>
          </div>

          {/* 하단 기능 뱃지 */}
          <div
            className="mt-7 flex justify-center gap-6"
            style={fade(0.5)}
          >
            {[
              { label: 'GitHub 연동', icon: LinkIcon },
              { label: 'AI 코드 리뷰', icon: AIIcon },
              { label: '성장 통계', icon: ChartIcon },
            ].map((f) => (
              <div
                key={f.label}
                className="flex items-center gap-1.5 text-[11px] text-text-3"
              >
                <f.icon />
                {f.label}
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="py-5 text-center">
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

function LinkIcon(): ReactNode {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
    </svg>
  );
}

function AIIcon(): ReactNode {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v4m0 14v4M4.22 4.22l2.83 2.83m9.9 9.9l2.83 2.83M1 12h4m14 0h4M4.22 19.78l2.83-2.83m9.9-9.9l2.83-2.83" />
    </svg>
  );
}

function ChartIcon(): ReactNode {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 20V10" />
      <path d="M12 20V4" />
      <path d="M6 20v-6" />
    </svg>
  );
}
