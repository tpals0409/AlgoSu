/**
 * @file Register 온보딩 2단계 — 아바타 프리셋 선택
 * @domain identity
 * @layer page
 * @related AuthContext, authApi, Logo, avatars
 */

'use client';

import { useState, useCallback, useEffect, type ReactNode } from 'react';
import { useRouter } from '@/i18n/navigation';
import { Link } from '@/i18n/navigation';
import Image from 'next/image';
import { Alert } from '@/components/ui/Alert';
import { InlineSpinner } from '@/components/ui/LoadingSpinner';
import { authApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { AVATAR_PRESETS, getAvatarSrc, toAvatarUrl } from '@/lib/avatars';
import { OnboardingStepper } from '@/components/onboarding/OnboardingStepper';


// ─── PROFILE CONTENT ────────────────────

export default function RegisterProfilePage(): ReactNode {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [selected, setSelected] = useState<string>('default');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
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

  // 사용자 기존 아바타 프리셋 로드
  useEffect(() => {
    if (user?.avatarPreset) {
      setSelected(user.avatarPreset);
    }
  }, [user?.avatarPreset]);

  /** 프로필 저장 후 다음 단계로 이동 */
  const handleNext = useCallback(async () => {
    setError(null);
    setSaving(true);
    try {
      await authApi.updateProfile({ avatar_url: toAvatarUrl(selected) });
      router.push('/register/github');
    } catch {
      setError('프로필 저장에 실패했습니다. 다시 시도해주세요.');
      setSaving(false);
    }
  }, [selected, router]);

  /** fade-in 스타일 */
  const fade = (delay = 0): React.CSSProperties => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(20px)',
    transition: `opacity .6s cubic-bezier(.16,1,.3,1) ${delay}s, transform .6s cubic-bezier(.16,1,.3,1) ${delay}s`,
  });

  return (
    <div className="flex min-h-screen flex-col bg-bg text-text">
      {/* MAIN */}
      <main className="relative flex flex-1 items-center justify-center overflow-hidden px-6">
        {/* 배경 glow */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'var(--hero-glow)' }}
        />

        <div className="relative w-full max-w-[420px]" style={fade(0)}>
          <div className="pt-10 pb-8 px-8">
            {/* Stepper */}
            <div style={fade(0.05)}>
              <OnboardingStepper current={2} />
            </div>

            {/* 제목 */}
            <div className="mb-6 text-center" style={fade(0.1)}>
              <h1 className="mb-1.5 text-[22px] font-bold tracking-tight text-text leading-snug">
                프로필을 꾸며볼까요?
              </h1>
              <p className="text-[13px] text-text-3">
                알고리즘 테마 아바타를 선택하세요
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

            {/* 아바타 프리셋 그리드 */}
            <div
              className="mb-6 grid grid-cols-5 gap-3 justify-items-center"
              style={fade(0.2)}
            >
              {AVATAR_PRESETS.map((preset) => {
                const isSelected = selected === preset.key;
                return (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => setSelected(preset.key)}
                    className={`flex flex-col items-center gap-1 rounded-card p-2 transition-all ${isSelected ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-bg-alt'}`}
                    aria-label={preset.label}
                    aria-pressed={isSelected}
                  >
                    <Image
                      src={getAvatarSrc(preset.key)}
                      alt={preset.label}
                      width={48}
                      height={48}
                      className="rounded-full"
                    />
                    <span className={`text-[10px] ${isSelected ? 'text-primary font-medium' : 'text-text-3'}`}>
                      {preset.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* 다음 버튼 */}
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleNext()}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-btn bg-primary text-sm font-medium text-white transition-all hover:brightness-95 disabled:opacity-50"
              style={fade(0.35)}
            >
              {saving ? <InlineSpinner /> : null}
              {saving ? '저장 중...' : '다음 \u2014 GitHub 연동'}
            </button>

            {/* 건너뛰기 */}
            <p
              className="mt-4 text-center"
              style={fade(0.4)}
            >
              <Link
                href="/studies"
                className="text-[13px] text-text-3 hover:text-text transition-colors"
              >
                건너뛰기
              </Link>
            </p>
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
