/**
 * @file 프로필 페이지 (v2 디자인 시스템)
 * @domain identity
 * @layer page
 * @related AuthContext, authApi, AppLayout, avatars
 */

'use client';

import { useState, useEffect, useCallback, type ReactNode, type CSSProperties } from 'react';
import {
  Github,
  LogOut,
  RefreshCw,
  Link2,
  Unlink,
  Pencil,
  Camera,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { Skeleton } from '@/components/ui/Skeleton';
import { InlineSpinner } from '@/components/ui/LoadingSpinner';
import { useAuth } from '@/contexts/AuthContext';
import { useStudy } from '@/contexts/StudyContext';
import { authApi } from '@/lib/api';
import { getGitHubUsername } from '@/lib/auth';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { AVATAR_PRESETS, getAvatarSrc } from '@/lib/avatars';
import { ShareLinkManager } from '@/components/profile/ShareLinkManager';
import Image from 'next/image';
import { cn } from '@/lib/utils';

// ─── CONSTANTS ───────────────────────────

const OAUTH_PROVIDER_LABELS: Record<string, string> = {
  GOOGLE: 'Google',
  NAVER: 'Naver',
  KAKAO: 'Kakao',
};

// ─── RENDER ──────────────────────────────

/**
 * 사용자 프로필 페이지 — 아바타, 계정 정보, GitHub 연동, 소속 스터디
 * @domain identity
 */
export default function ProfilePage(): ReactNode {
  const { isReady } = useRequireAuth();
  const { user, logout, githubConnected, updateGitHubStatus, updateAvatar } =
    useAuth();
  useStudy();

  // ─── STATE ─────────────────────────────
  const [error, setError] = useState<string | null>(null);
  const [githubUsername, setGithubUsernameState] = useState<string | null>(null);
  const [githubLoading, setGithubLoading] = useState(false);

  const [displayName, setDisplayName] = useState<string | null>(null);
  const [oauthProvider, setOauthProvider] = useState<string | null>(null);

  // 아바타 선택
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);

  // 계정 삭제 확인
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // 로그아웃 확인
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // ─── ANIMATION ─────────────────────────

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  const fade = (delay = 0): CSSProperties => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(16px)',
    transition: `opacity .5s cubic-bezier(.16,1,.3,1) ${delay}s, transform .5s cubic-bezier(.16,1,.3,1) ${delay}s`,
  });

  // ─── EFFECTS ───────────────────────────

  useEffect(() => {
    setGithubUsernameState(getGitHubUsername());
    authApi
      .getProfile()
      .then((profile) => {
        setDisplayName(profile.name);
        setOauthProvider(profile.oauth_provider);
      })
      .catch(() => {
        // 프로필 로드 실패 시 무시
      });
  }, []);

  // ─── HANDLERS ──────────────────────────

  /**
   * GitHub 연동
   * @domain github
   */
  const handleLinkGitHub = useCallback(async () => {
    setError(null);
    setGithubLoading(true);
    try {
      const { url } = await authApi.linkGitHub();
      window.location.href = url;
    } catch {
      setError('GitHub 연동에 실패했습니다. 잠시 후 다시 시도해주세요.');
      setGithubLoading(false);
    }
  }, []);

  /**
   * GitHub 연동 해제
   * @domain github
   */
  const handleUnlinkGitHub = useCallback(async () => {
    setError(null);
    setGithubLoading(true);
    try {
      await authApi.unlinkGitHub();
      updateGitHubStatus(false);
      setGithubUsernameState(null);
    } catch {
      setError('GitHub 연동 해제에 실패했습니다.');
    } finally {
      setGithubLoading(false);
    }
  }, [updateGitHubStatus]);

  /**
   * GitHub 재연동
   * @domain github
   */
  const handleRelinkGitHub = useCallback(async () => {
    setError(null);
    setGithubLoading(true);
    try {
      const { url } = await authApi.relinkGitHub();
      window.location.href = url;
    } catch {
      setError('GitHub 재연동에 실패했습니다.');
      setGithubLoading(false);
    }
  }, []);

  /**
   * 아바타 선택
   * @domain identity
   */
  const handleSelectAvatar = useCallback(
    async (presetKey: string) => {
      setAvatarLoading(true);
      setError(null);
      try {
        await updateAvatar(presetKey);
        setShowAvatarPicker(false);
      } catch {
        setError('아바타 변경에 실패했습니다.');
      } finally {
        setAvatarLoading(false);
      }
    },
    [updateAvatar],
  );

  /**
   * 로그아웃
   * @domain identity
   */
  const handleLogout = useCallback(() => {
    logout();
  }, [logout]);

  /**
   * 계정 삭제
   * @domain identity
   */
  const handleDeleteAccount = useCallback(async () => {
    setDeleteLoading(true);
    setError(null);
    try {
      await authApi.deleteAccount();
      logout();
    } catch {
      setError('계정 삭제에 실패했습니다. 잠시 후 다시 시도해주세요.');
      setDeleteLoading(false);
      setShowDeleteConfirm(false);
    }
  }, [logout]);

  // ─── LOADING ───────────────────────────

  if (!isReady) {
    return (
      <AppLayout>
        <div className="space-y-4">
          <Skeleton height={32} width="30%" />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Skeleton height={320} />
            <div className="space-y-4">
              <Skeleton height={180} />
              <Skeleton height={80} />
              <Skeleton height={80} />
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  const profileName = displayName ?? user?.email?.split('@')[0] ?? '-';
  const providerLabel = oauthProvider
    ? (OAUTH_PROVIDER_LABELS[oauthProvider] ?? oauthProvider)
    : '';

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* 페이지 헤더 */}
        <div style={fade(0)}>
          <h1 className="text-[22px] font-bold tracking-tight text-text">프로필</h1>
          <p className="mt-0.5 text-sm text-text-3">
            계정 정보와 GitHub 연동을 관리하세요.
          </p>
        </div>

        {error && (
          <Alert variant="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* ── 2열 레이아웃 ── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2" style={fade(0.05)}>

          {/* ── 왼쪽: 프로필 카드 ── */}
          <Card className="flex flex-col items-center justify-center p-6">
            <div className="flex flex-col items-center">
              {/* 아바타 */}
              <div className="relative">
                <button
                  type="button"
                  className="w-24 h-24 shrink-0 overflow-hidden rounded-full ring-2 ring-transparent transition-all hover:ring-primary-light focus-visible:outline-none focus-visible:ring-primary"
                  onClick={() => setShowAvatarPicker((v) => !v)}
                  aria-label="아바타 변경"
                  disabled={avatarLoading}
                >
                  <Image
                    src={getAvatarSrc(user?.avatarPreset ?? 'default')}
                    alt="프로필 아바타"
                    width={96}
                    height={96}
                    className="h-full w-full"
                  />
                </button>
                <div
                  className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2"
                  style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
                >
                  <Camera className="h-3.5 w-3.5" style={{ color: 'var(--text-3)' }} />
                </div>
              </div>

              {/* 이름 + 이메일 */}
              <p className="mt-4 text-[16px] font-bold text-text">{profileName}</p>
              <p className="mt-0.5 text-[13px] text-text-3">{user?.email ?? '-'}</p>

              {/* 뱃지 */}
              <div className="mt-3 flex items-center gap-2">
                {providerLabel && (
                  <span
                    className="rounded-full px-3 py-0.5 text-[11px] font-semibold"
                    style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}
                  >
                    {providerLabel.toUpperCase()}
                  </span>
                )}
                {githubConnected && (
                  <span
                    className="flex items-center gap-1 rounded-full px-3 py-0.5 text-[11px] font-semibold"
                    style={{ background: 'var(--success-soft)', color: 'var(--success)' }}
                  >
                    <Github className="h-3 w-3" aria-hidden />
                    연결됨
                  </span>
                )}
              </div>

            </div>

            {/* 아바타 선택 그리드 */}
            {showAvatarPicker && (
              <div className="mt-5 w-full rounded-card border p-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-alt)' }}>
                <p className="mb-3 text-[12px] font-medium text-text">아바타 선택</p>
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
                  {AVATAR_PRESETS.map((preset) => {
                    const isSelected = (user?.avatarPreset ?? 'default') === preset.key;
                    return (
                      <button
                        key={preset.key}
                        type="button"
                        className={cn(
                          'flex flex-col items-center gap-1.5 rounded-btn p-2 transition-all',
                          isSelected
                            ? 'ring-2 ring-primary bg-primary-soft'
                            : 'hover:bg-bg-card',
                        )}
                        onClick={() => void handleSelectAvatar(preset.key)}
                        disabled={avatarLoading}
                        aria-label={preset.label}
                        aria-pressed={isSelected}
                      >
                        <Image
                          src={getAvatarSrc(preset.key)}
                          alt={preset.label}
                          width={40}
                          height={40}
                          className="rounded-full"
                        />
                        <span className="text-[10px] text-text-3">{preset.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </Card>

          {/* ── 오른쪽: 정보 카드들 ── */}
          <div className="space-y-4">

            {/* 기본 정보 */}
            <Card className="p-5" style={fade(0.1)}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[14px] font-semibold text-text">기본 정보</h3>
                <button
                  type="button"
                  className="flex items-center gap-1 text-[12px] text-text-3 transition-colors hover:text-text"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                  수정
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-[11px] text-text-3">이름</p>
                  <p className="mt-0.5 text-[14px] font-medium text-text">{profileName}</p>
                </div>
                <div>
                  <p className="text-[11px] text-text-3">이메일</p>
                  <p className="mt-0.5 text-[14px] font-medium text-text">{user?.email ?? '-'}</p>
                </div>
                <div>
                  <p className="text-[11px] text-text-3">로그인 방식</p>
                  <p className="mt-0.5 text-[14px] font-medium text-text">
                    {providerLabel ? providerLabel.toUpperCase() : '-'}
                  </p>
                </div>
              </div>
            </Card>

            {/* GitHub 연동 */}
            <Card className="p-5" style={fade(0.15)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: 'var(--bg-alt)' }}
                  >
                    <Github className="h-5 w-5 text-text" aria-hidden />
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-text">GitHub 연동</p>
                    <p className="text-[12px] text-text-3">
                      {githubConnected
                        ? `@${githubUsername ?? 'unknown'}`
                        : '코드 제출을 위해 연동이 필요합니다'}
                    </p>
                  </div>
                </div>
                {githubConnected ? (
                  <span
                    className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold"
                    style={{ border: '1px solid var(--success)', color: 'var(--success)' }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--success)' }} />
                    연결됨
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={githubLoading}
                    onClick={() => void handleLinkGitHub()}
                    className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold transition-colors"
                    style={{ background: 'var(--primary)', color: 'white' }}
                  >
                    {githubLoading ? <InlineSpinner /> : <Link2 className="h-3 w-3" aria-hidden />}
                    연동하기
                  </button>
                )}
              </div>
              {/* 재연동 / 해제 (연동 상태일 때) */}
              {githubConnected && (
                <div className="mt-3 flex items-center gap-2 pl-0 sm:pl-[52px]">
                  <button
                    type="button"
                    disabled={githubLoading}
                    onClick={() => void handleRelinkGitHub()}
                    className="flex items-center gap-1 text-[11px] text-text-3 transition-colors hover:text-text"
                  >
                    {githubLoading ? <InlineSpinner /> : <RefreshCw className="h-3 w-3" aria-hidden />}
                    재연동
                  </button>
                  <span className="text-text-3">·</span>
                  <button
                    type="button"
                    disabled={githubLoading}
                    onClick={() => void handleUnlinkGitHub()}
                    className="flex items-center gap-1 text-[11px] transition-colors hover:opacity-80"
                    style={{ color: 'var(--error)' }}
                  >
                    {githubLoading ? <InlineSpinner /> : <Unlink className="h-3 w-3" aria-hidden />}
                    해제
                  </button>
                </div>
              )}
            </Card>

            {/* 계정 관리 */}
            <Card className="p-5" style={fade(0.2)}>
              <h3 className="text-[14px] font-semibold text-text mb-4">계정 관리</h3>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <button
                  type="button"
                  onClick={() => setShowLogoutConfirm(true)}
                  className="flex items-center justify-center gap-2 rounded-btn px-4 py-2 text-[13px] font-medium text-text-2 transition-colors hover:bg-bg-alt"
                  style={{ border: '1px solid var(--border)' }}
                >
                  <LogOut className="h-4 w-4" aria-hidden />
                  로그아웃
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center justify-center gap-2 rounded-btn px-4 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
                  style={{ background: 'var(--error)' }}
                >
                  계정 탈퇴
                </button>
              </div>
            </Card>
          </div>
        </div>

        {/* 로그아웃 확인 모달 */}
        {showLogoutConfirm && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowLogoutConfirm(false)} />
            <div className="relative rounded-xl border border-border bg-bg-card p-5 shadow-lg w-[340px] space-y-4">
              <p className="text-[14px] font-semibold text-text">로그아웃 하시겠습니까?</p>
              <p className="text-[13px]" style={{ color: 'var(--text-2)' }}>현재 세션이 종료되고 로그인 페이지로 이동합니다.</p>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowLogoutConfirm(false)}
                  className="px-4 py-2 rounded-lg text-[13px] font-medium transition-colors hover:bg-bg-alt"
                  style={{ color: 'var(--text-2)' }}
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-4 py-2 rounded-lg text-[13px] font-medium text-white transition-opacity"
                  style={{ backgroundColor: 'var(--primary)' }}
                >
                  로그아웃
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 계정 삭제 확인 모달 */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowDeleteConfirm(false)} />
            <div className="relative rounded-xl border border-border bg-bg-card p-5 shadow-lg w-[340px] space-y-4">
              <p className="text-[14px] font-semibold text-text">계정을 삭제하시겠습니까?</p>
              <p className="text-[13px]" style={{ color: 'var(--text-2)' }}>이 작업은 되돌릴 수 없습니다. 모든 데이터가 영구 삭제됩니다.</p>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleteLoading}
                  className="px-4 py-2 rounded-lg text-[13px] font-medium transition-colors hover:bg-bg-alt"
                  style={{ color: 'var(--text-2)' }}
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={() => void handleDeleteAccount()}
                  disabled={deleteLoading}
                  className="px-4 py-2 rounded-lg text-[13px] font-medium text-white transition-opacity disabled:opacity-50"
                  style={{ backgroundColor: 'var(--error)' }}
                >
                  {deleteLoading ? '삭제 중...' : '삭제'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 공유 링크 관리 (W2-4) */}
        <ShareLinkManager />
      </div>
    </AppLayout>
  );
}
