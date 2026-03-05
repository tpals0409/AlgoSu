/**
 * @file 프로필 페이지 (v2 디자인 시스템)
 * @domain identity
 * @layer page
 * @related AuthContext, authApi, AppLayout, avatars
 */

'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  User,
  Github,
  LogOut,
  RefreshCw,
  Link2,
  Unlink,
  FileText,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Skeleton } from '@/components/ui/Skeleton';
import { InlineSpinner } from '@/components/ui/LoadingSpinner';
import { useAuth } from '@/contexts/AuthContext';
import { useStudy } from '@/contexts/StudyContext';
import { authApi, submissionApi } from '@/lib/api';
import { getGitHubUsername } from '@/lib/auth';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { AVATAR_PRESETS, getAvatarSrc } from '@/lib/avatars';
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
  const router = useRouter();
  const { isReady } = useRequireAuth();
  const { user, logout, githubConnected, updateGitHubStatus, updateAvatar } =
    useAuth();
  const { studies, currentStudyId } = useStudy();

  // ─── STATE ─────────────────────────────
  const [error, setError] = useState<string | null>(null);
  const [githubUsername, setGithubUsernameState] = useState<string | null>(null);
  const [githubLoading, setGithubLoading] = useState(false);

  const [displayName, setDisplayName] = useState<string | null>(null);
  const [oauthProvider, setOauthProvider] = useState<string | null>(null);

  // 개인 통계
  const [totalSubmissions, setTotalSubmissions] = useState<number>(0);
  const [statsLoading, setStatsLoading] = useState(true);

  // 아바타 선택
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);

  // 계정 삭제 확인
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

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

  useEffect(() => {
    if (!isReady || !currentStudyId) return;
    setStatsLoading(true);
    submissionApi.list({ page: 1, limit: 1 })
      .then((result) => {
        setTotalSubmissions(result.meta.total);
      })
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }, [isReady, currentStudyId]);

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
    router.replace('/login');
  }, [logout, router]);

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
      router.replace('/login');
    } catch {
      setError('계정 삭제에 실패했습니다. 잠시 후 다시 시도해주세요.');
      setDeleteLoading(false);
      setShowDeleteConfirm(false);
    }
  }, [logout, router]);

  // ─── LOADING ───────────────────────────

  if (!isReady) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-[640px] space-y-4">
          <Skeleton height={32} width="30%" />
          <Skeleton height={200} />
          <Skeleton height={150} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-[640px] space-y-6">
        {/* 페이지 헤더 */}
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-text">프로필</h1>
          <p className="mt-0.5 text-xs text-text-3">
            계정 정보 및 연동 설정
          </p>
        </div>

        {error && (
          <Alert variant="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* 프로필 카드 */}
        <Card>
          <CardContent className="py-5">
            <div className="flex items-center gap-4">
              {/* 아바타 */}
              <button
                type="button"
                className="w-16 h-16 shrink-0 overflow-hidden rounded-full ring-2 ring-transparent transition-all hover:ring-primary-light focus-visible:outline-none focus-visible:ring-primary"
                onClick={() => setShowAvatarPicker((v) => !v)}
                aria-label="아바타 변경"
                disabled={avatarLoading}
              >
                <Image
                  src={getAvatarSrc(user?.avatarPreset ?? 'default')}
                  alt="프로필 아바타"
                  width={64}
                  height={64}
                  className="h-full w-full"
                />
              </button>

              <div className="min-w-0 flex-1">
                {/* 닉네임 (OAuth 이름, 수정 불가) */}
                <p className="truncate text-sm font-medium text-text">
                  {displayName ?? user?.email?.split('@')[0] ?? '-'}
                </p>

                {/* 이메일 + OAuth */}
                <div className="mt-1 flex items-center gap-2">
                  <User className="h-3 w-3 text-text-3" aria-hidden />
                  <span className="font-mono text-[11px] text-text-3">
                    {user?.email ?? '-'}
                  </span>
                  {oauthProvider && (
                    <Badge variant="info">
                      {OAUTH_PROVIDER_LABELS[oauthProvider] ?? oauthProvider}
                    </Badge>
                  )}
                </div>
              </div>

              {/* 로그아웃 */}
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="h-3.5 w-3.5" aria-hidden />
                로그아웃
              </Button>
            </div>

            {/* 아바타 선택 그리드 */}
            {showAvatarPicker && (
              <div className="mt-5 rounded-card border border-border bg-bg-alt p-4">
                <p className="mb-3 text-[12px] font-medium text-text">
                  아바타 선택
                </p>
                <div className="grid grid-cols-5 gap-3">
                  {AVATAR_PRESETS.map((preset) => {
                    const isSelected =
                      (user?.avatarPreset ?? 'default') === preset.key;
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
                        <span className="text-[10px] text-text-3">
                          {preset.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 개인 통계 */}
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-soft">
                <FileText className="h-4 w-4 text-primary" aria-hidden />
              </div>
              <div>
                {statsLoading ? (
                  <Skeleton height={24} width={40} />
                ) : (
                  <p className="font-mono text-xl font-bold text-primary">{totalSubmissions}</p>
                )}
                <p className="text-[11px] text-text-3">총 제출</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-success-soft">
                <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />
              </div>
              <div>
                <p className="font-mono text-xl font-bold text-success">{studies.length}</p>
                <p className="text-[11px] text-text-3">참여 스터디</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-bg-alt">
                <Github className="h-4 w-4 text-text" aria-hidden />
              </div>
              <div>
                <p className="font-mono text-xl font-bold text-text">
                  {githubConnected ? '연동' : '미연동'}
                </p>
                <p className="text-[11px] text-text-3">GitHub</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* GitHub 연동 */}
        <Card>
          <CardHeader>
            <CardTitle>GitHub 연동</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-btn bg-bg-alt">
                  <Github className="h-5 w-5 text-text" aria-hidden />
                </div>
                <div>
                  {githubConnected ? (
                    <>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-text">
                          {githubUsername ?? 'GitHub 계정'}
                        </p>
                        <Badge variant="success" dot>
                          연동됨
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-[11px] text-text-3">
                        코드 제출 시 자동으로 Push됩니다
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-text">
                          GitHub 미연동
                        </p>
                        <Badge variant="muted">미연동</Badge>
                      </div>
                      <p className="mt-0.5 text-[11px] text-text-3">
                        코드 제출을 위해 GitHub 연동이 필요합니다
                      </p>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {githubConnected ? (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={githubLoading}
                      onClick={() => void handleRelinkGitHub()}
                    >
                      {githubLoading ? (
                        <InlineSpinner />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                      )}
                      재연동
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={githubLoading}
                      onClick={() => void handleUnlinkGitHub()}
                    >
                      {githubLoading ? (
                        <InlineSpinner />
                      ) : (
                        <Unlink className="h-3.5 w-3.5" aria-hidden />
                      )}
                      해제
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={githubLoading}
                    onClick={() => void handleLinkGitHub()}
                  >
                    {githubLoading ? (
                      <InlineSpinner />
                    ) : (
                      <Link2 className="h-3.5 w-3.5" aria-hidden />
                    )}
                    GitHub 연동
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 소속 스터디 */}
        <Card>
          <CardHeader>
            <CardTitle>소속 스터디</CardTitle>
          </CardHeader>
          <CardContent>
            {studies.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-text-3">
                  참여 중인 스터디가 없습니다.
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  className="mt-3"
                  onClick={() => router.push('/studies')}
                >
                  스터디 참여하기
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {studies.map((study) => (
                  <div
                    key={study.id}
                    className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text">
                        {study.name}
                      </p>
                      {study.description && (
                        <p className="mt-0.5 truncate text-[11px] text-text-3">
                          {study.description}
                        </p>
                      )}
                    </div>
                    <div className="ml-3 flex items-center gap-2">
                      <Badge
                        variant={study.role === 'ADMIN' ? 'info' : 'muted'}
                      >
                        {study.role === 'ADMIN' ? '관리자' : '멤버'}
                      </Badge>
                      {study.memberCount !== undefined && (
                        <span className="font-mono text-[10px] text-text-3">
                          {study.memberCount}명
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 법적 고지 */}
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-[13px] font-medium text-text">법적 고지</h3>
            <div className="flex flex-col gap-1">
              <button type="button" className="text-left text-[12px] text-text-2 hover:text-primary transition-colors focus-visible:outline-none focus-visible:text-primary">
                서비스 이용약관
              </button>
              <button type="button" className="text-left text-[12px] text-text-2 hover:text-primary transition-colors focus-visible:outline-none focus-visible:text-primary">
                개인정보 처리방침
              </button>
            </div>
          </CardContent>
        </Card>

        {/* 계정 삭제 */}
        <Card className="border-error/20">
          <CardContent className="p-4">
            <h3 className="text-[13px] font-medium text-error mb-1">계정 삭제</h3>
            <p className="text-[11px] text-text-3 mb-3">
              계정을 삭제하면 모든 데이터가 영구적으로 삭제되며 복구할 수 없습니다.
            </p>
            <Button variant="danger" size="sm" onClick={() => setShowDeleteConfirm(true)}>
              <Trash2 className="h-3 w-3" />
              계정 삭제
            </Button>
          </CardContent>
        </Card>

        {/* 계정 삭제 확인 다이얼로그 */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-card border border-border bg-bg-card p-6 shadow-modal">
              <h3 className="text-[15px] font-bold text-error mb-2">정말 계정을 삭제하시겠습니까?</h3>
              <p className="text-[12px] text-text-3 mb-5">
                이 작업은 되돌릴 수 없습니다. 모든 데이터(제출, 스터디, 프로필)가 영구 삭제됩니다.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(false)} disabled={deleteLoading}>
                  취소
                </Button>
                <Button variant="danger" size="sm" onClick={() => void handleDeleteAccount()} disabled={deleteLoading}>
                  {deleteLoading ? <InlineSpinner /> : <Trash2 className="h-3 w-3" />}
                  {deleteLoading ? '삭제 중...' : '삭제 확인'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
