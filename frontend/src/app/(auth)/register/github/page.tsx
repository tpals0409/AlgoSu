/**
 * @file Register 온보딩 3단계 — GitHub 연동 선택
 * @domain identity
 * @layer page
 * @related AuthContext, authApi, Logo
 */

'use client';

import { useState, useCallback, useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { Sun, Moon, Github, CheckCircle } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { Alert } from '@/components/ui/Alert';
import { InlineSpinner } from '@/components/ui/LoadingSpinner';
import { authApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

// ─── CONSTANTS ────────────────────────────

const BENEFITS = [
  '자동 커밋 기록',
  '포트폴리오 구축',
  '제출 이력 백업',
] as const;

// ─── STEPPER ─────────────────────────────

function OnboardingStepper({ current }: { current: 1 | 2 | 3 }): ReactNode {
  const steps = ['가입', '프로필', 'GitHub'];
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((label, i) => {
        const step = i + 1;
        const isActive = step === current;
        const isDone = step < current;
        return (
          <div key={label} className="flex items-center gap-2">
            {i > 0 && <div className={`h-px w-6 ${isDone ? 'bg-primary' : 'bg-border'}`} />}
            <div className={`flex items-center gap-1.5 text-xs font-medium ${isActive ? 'text-primary' : isDone ? 'text-primary/60' : 'text-text-3'}`}>
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${isActive ? 'bg-primary text-white' : isDone ? 'bg-primary/20 text-primary' : 'bg-bg-alt text-text-3'}`}>
                {isDone ? '\u2713' : step}
              </span>
              {label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── GITHUB CONTENT ─────────────────────

export default function RegisterGitHubPage(): ReactNode {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, githubConnected } = useAuth();
  const { theme, setTheme } = useTheme();
  const [error, setError] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // 인증 가드: 미인증 시 로그인으로 리다이렉트
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  // 이미 GitHub 연동된 경우 3초 후 자동 리다이렉트
  useEffect(() => {
    if (!authLoading && githubConnected) {
      const timer = setTimeout(() => {
        router.replace('/studies');
      }, 3000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [authLoading, githubConnected, router]);

  /** GitHub 연동 핸들러 */
  const handleLinkGitHub = useCallback(async () => {
    setError(null);
    setLinking(true);
    try {
      const { url } = await authApi.linkGitHub();
      window.location.href = url;
    } catch {
      setError('GitHub 연동에 실패했습니다. 다시 시도해주세요.');
      setLinking(false);
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
            className="flex h-9 w-9 items-center justify-center rounded-btn text-text-3 hover:text-text hover:bg-bg-alt transition-colors"
            aria-label="테마 전환"
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
            {/* Stepper */}
            <div style={fade(0.05)}>
              <OnboardingStepper current={3} />
            </div>

            {/* 이미 연동된 경우 */}
            {githubConnected ? (
              <div className="text-center" style={fade(0.1)}>
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <CheckCircle className="h-8 w-8 text-primary" />
                </div>
                <h1 className="mb-2 text-[22px] font-bold tracking-tight text-text leading-snug">
                  이미 GitHub가 연동되어 있습니다
                </h1>
                <p className="text-[13px] text-text-3">
                  잠시 후 스터디 페이지로 이동합니다...
                </p>
              </div>
            ) : (
              <>
                {/* GitHub 아이콘 */}
                <div className="mb-5 flex justify-center" style={fade(0.1)}>
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-bg-alt">
                    <Github className="h-8 w-8 text-text" />
                  </div>
                </div>

                {/* 제목 */}
                <div className="mb-6 text-center" style={fade(0.15)}>
                  <h1 className="mb-1.5 text-[22px] font-bold tracking-tight text-text leading-snug">
                    GitHub를 연동하시겠어요?
                  </h1>
                  <p className="text-[13px] text-text-3">
                    코드 제출을 자동으로 GitHub에 기록할 수 있습니다
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

                {/* 장점 목록 */}
                <div className="mb-6 space-y-3" style={fade(0.25)}>
                  {BENEFITS.map((benefit) => (
                    <div key={benefit} className="flex items-center gap-2.5">
                      <CheckCircle className="h-4 w-4 shrink-0 text-primary" />
                      <span className="text-[13px] text-text">
                        {benefit}
                      </span>
                    </div>
                  ))}
                </div>

                {/* GitHub 연동 버튼 */}
                <button
                  type="button"
                  disabled={linking}
                  onClick={() => void handleLinkGitHub()}
                  className="flex h-12 w-full items-center justify-center gap-2.5 rounded-btn bg-primary text-sm font-medium text-white transition-all hover:brightness-95 disabled:opacity-50"
                  style={fade(0.35)}
                >
                  {linking ? (
                    <InlineSpinner />
                  ) : (
                    <Github className="h-4 w-4" />
                  )}
                  {linking ? '연결 중...' : 'GitHub 연동하기'}
                </button>

                {/* 나중에 하기 */}
                <p
                  className="mt-4 text-center"
                  style={fade(0.4)}
                >
                  <Link
                    href="/studies"
                    className="text-[13px] text-text-3 hover:text-text transition-colors"
                  >
                    나중에 하기
                  </Link>
                </p>
              </>
            )}
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="py-5 text-center">
        <div className="mb-2 flex items-center justify-center gap-4 text-[12px] font-medium text-text-3">
          <Link href="/privacy" className="transition-colors hover:text-text">
            개인정보처리방침
          </Link>
          <span aria-hidden>·</span>
          <Link href="/terms" className="transition-colors hover:text-text">
            이용약관
          </Link>
        </div>
        <p className="text-[11px] text-text-3">
          &copy; {new Date().getFullYear()} AlgoSu. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
