'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { User, Github, LogOut, RefreshCw, Link2, Unlink } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Skeleton } from '@/components/ui/Skeleton';
import { InlineSpinner } from '@/components/ui/LoadingSpinner';
import { useAuth } from '@/contexts/AuthContext';
import { useStudy } from '@/contexts/StudyContext';
import { authApi, studyApi, type Study } from '@/lib/api';
import {
  getGitHubConnected,
  setGitHubConnected,
  getGitHubUsername,
  setGitHubUsername,
} from '@/lib/auth';

const OAUTH_PROVIDER_LABELS: Record<string, { label: string; color: string }> = {
  google: { label: 'Google', color: 'bg-[#4285F4]' },
  naver: { label: 'Naver', color: 'bg-[#03C75A]' },
  kakao: { label: 'Kakao', color: 'bg-[#FEE500]' },
};

function getInitials(email?: string | null): string {
  const src = email ?? '';
  return src.slice(0, 2).toUpperCase();
}

export default function ProfilePage(): ReactNode {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth();
  const { studies: contextStudies } = useStudy();

  const [studies, setStudies] = useState<Study[]>(contextStudies);
  const [studiesLoading, setStudiesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [githubConnected, setGithubConnectedState] = useState(false);
  const [githubUsername, setGithubUsernameState] = useState<string | null>(null);
  const [githubLoading, setGithubLoading] = useState(false);

  // 인증 확인
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  // 스터디 목록 로드
  const loadStudies = useCallback(async () => {
    setStudiesLoading(true);
    try {
      const data = await studyApi.list();
      setStudies(data);
    } catch {
      // 스터디 로드 실패는 무시 (컨텍스트 데이터 사용)
    } finally {
      setStudiesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      void loadStudies();
    }
  }, [isAuthenticated, loadStudies]);

  // GitHub 연동 상태 초기화 (localStorage 캐시)
  useEffect(() => {
    setGithubConnectedState(getGitHubConnected());
    setGithubUsernameState(getGitHubUsername());
  }, []);

  // GitHub 연동 시작
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

  // GitHub 연동 해제
  const handleUnlinkGitHub = useCallback(async () => {
    setError(null);
    setGithubLoading(true);
    try {
      await authApi.unlinkGitHub();
      setGithubConnectedState(false);
      setGitHubConnected(false);
      setGithubUsernameState(null);
      setGitHubUsername(null);
    } catch {
      setError('GitHub 연동 해제에 실패했습니다.');
    } finally {
      setGithubLoading(false);
    }
  }, []);

  // GitHub 재연동
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

  const handleLogout = useCallback(() => {
    logout();
    router.replace('/login');
  }, [logout, router]);

  if (authLoading) {
    return (
      <AppLayout>
        <div className="space-y-4">
          <Skeleton height={32} width="30%" />
          <Skeleton height={200} />
          <Skeleton height={150} />
        </div>
      </AppLayout>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* 페이지 헤더 */}
        <div>
          <h1 className="text-base font-semibold text-foreground">프로필</h1>
          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
            계정 정보 및 연동 설정
          </p>
        </div>

        {error && (
          <Alert variant="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* 사용자 정보 카드 */}
        <Card>
          <CardHeader>
            <CardTitle>계정 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              {/* 아바타 */}
              <div
                className="flex shrink-0 items-center justify-center rounded-full text-white"
                style={{
                  width: '56px',
                  height: '56px',
                  background: 'linear-gradient(135deg, var(--color-main), var(--color-sub))',
                  fontSize: '18px',
                  fontWeight: 600,
                }}
              >
                {getInitials(user?.email)}
              </div>

              <div className="min-w-0 flex-1">
                {/* 이메일 */}
                <p className="text-sm font-medium text-foreground truncate">
                  {user?.email ?? '-'}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <User className="h-3 w-3 text-muted-foreground" aria-hidden />
                  <span className="font-mono text-[11px] text-muted-foreground">
                    OAuth 로그인
                  </span>
                </div>
              </div>

              {/* 로그아웃 버튼 */}
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="h-3.5 w-3.5" aria-hidden />
                로그아웃
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* GitHub 연동 카드 */}
        <Card>
          <CardHeader>
            <CardTitle>GitHub 연동</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="flex items-center justify-center rounded-md bg-bg2"
                  style={{ width: '40px', height: '40px' }}
                >
                  <Github className="h-5 w-5 text-foreground" aria-hidden />
                </div>
                <div>
                  {githubConnected ? (
                    <>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">
                          {githubUsername ?? 'GitHub 계정'}
                        </p>
                        <Badge variant="success" dot>연동됨</Badge>
                      </div>
                      <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                        코드 제출 시 자동으로 Push됩니다
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">
                          GitHub 미연동
                        </p>
                        <Badge variant="muted">미연동</Badge>
                      </div>
                      <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                        코드 제출을 위해 GitHub 연동이 필요합니다
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* 연동/해제/재연동 버튼 */}
              <div className="flex items-center gap-2">
                {githubConnected ? (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={githubLoading}
                      onClick={() => void handleRelinkGitHub()}
                    >
                      {githubLoading ? <InlineSpinner /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden />}
                      재연동
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={githubLoading}
                      onClick={() => void handleUnlinkGitHub()}
                    >
                      {githubLoading ? <InlineSpinner /> : <Unlink className="h-3.5 w-3.5" aria-hidden />}
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
                    {githubLoading ? <InlineSpinner /> : <Link2 className="h-3.5 w-3.5" aria-hidden />}
                    GitHub 연동
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 소속 스터디 카드 */}
        <Card>
          <CardHeader>
            <CardTitle>소속 스터디</CardTitle>
          </CardHeader>
          <CardContent>
            {studiesLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} height={48} />
                ))}
              </div>
            ) : studies.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground">
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
                      <p className="text-sm font-medium text-foreground truncate">
                        {study.name}
                      </p>
                      {study.description && (
                        <p className="mt-0.5 text-[11px] text-muted-foreground truncate">
                          {study.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-3">
                      <Badge variant={study.role === 'OWNER' ? 'default' : 'muted'}>
                        {study.role === 'OWNER' ? '방장' : '멤버'}
                      </Badge>
                      {study.memberCount !== undefined && (
                        <span className="font-mono text-[10px] text-muted-foreground">
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
      </div>
    </AppLayout>
  );
}
