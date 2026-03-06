'use client';

import { Suspense } from 'react';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { LoadingSpinner, InlineSpinner } from '@/components/ui/LoadingSpinner';
import { Alert } from '@/components/ui/Alert';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { setGitHubConnected } from '@/lib/auth';
import { authApi } from '@/lib/api';

/**
 * @file OAuth 콜백 페이지 — /callback
 * @domain identity
 * @layer page
 * @related OAuthController, AuthContext
 *
 * 백엔드가 httpOnly Cookie로 JWT를 설정하고, github_connected만 fragment로 전달.
 * /callback#github_connected=true|false
 *
 * github_connected=false 시 GitHub 연동 선택 UI를 인라인으로 표시.
 */

type CallbackStep = 'loading' | 'error' | 'github-prompt';

function CallbackContent(): ReactNode {
  const router = useRouter();
  const { loginFromCookie } = useAuth();
  const [step, setStep] = useState<CallbackStep>('loading');
  const [error, setError] = useState<string | null>(null);
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);

    const githubConnected = params.get('github_connected');
    const errorParam = params.get('error');

    if (errorParam) {
      const decoded = decodeURIComponent(errorParam);
      const friendlyMessage = decoded.includes('이미') || decoded.includes('가입')
        ? decoded
        : 'OAuth 인증에 실패했습니다. 다시 시도해주세요.';
      setError(friendlyMessage);
      setStep('error');
      return;
    }

    // httpOnly Cookie로 JWT가 이미 설정됨 — AuthContext에 알림
    loginFromCookie();

    // GitHub 연동 상태 저장
    if (githubConnected !== null) {
      setGitHubConnected(githubConnected === 'true');
    }

    if (githubConnected === 'false') {
      setStep('github-prompt');
    } else {
      // github_connected=true 또는 파라미터 없음 → 홈으로
      router.replace('/');
    }
  }, [router, loginFromCookie]);

  const handleLinkGitHub = useCallback(async () => {
    setLinkError(null);
    setLinkLoading(true);
    try {
      const { url } = await authApi.linkGitHub();
      window.location.href = url;
    } catch {
      setLinkError('GitHub 연동 서비스에 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
      setLinkLoading(false);
    }
  }, []);

  const handleSkip = useCallback(() => {
    router.replace('/');
  }, [router]);

  if (step === 'error') {
    return (
      <div className="w-full max-w-md space-y-4">
        <Alert variant="error">
          {error}
        </Alert>
        <div className="text-center">
          <Link href="/login" className="text-sm text-primary underline-offset-4 transition-colors hover:text-primary-light hover:underline">
            로그인 페이지로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  if (step === 'github-prompt') {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>GitHub 계정 연동</CardTitle>
          <CardDescription>
            GitHub을 연동하면 코드 자동 업로드 기능을 사용할 수 있습니다.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {linkError && (
            <Alert variant="error" onClose={() => setLinkError(null)}>
              {linkError}
            </Alert>
          )}

          <ul className="space-y-2 rounded-card bg-bg-alt p-4 text-sm text-text-2">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
              코드 제출 시 GitHub 레포지토리에 자동으로 Push됩니다.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
              스터디 팀원들과 코드를 공유하고 AI 분석 결과를 받을 수 있습니다.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
              GitHub 연동은 프로필에서 언제든 설정할 수 있습니다.
            </li>
          </ul>
        </CardContent>

        <CardFooter className="flex-col gap-3">
          <Button
            variant="primary"
            size="md"
            className="w-full"
            disabled={linkLoading}
            onClick={() => void handleLinkGitHub()}
          >
            {linkLoading ? (
              <>
                <InlineSpinner />
                연결 중...
              </>
            ) : (
              'GitHub 연동하기'
            )}
          </Button>
          <Button
            variant="ghost"
            size="md"
            className="w-full"
            disabled={linkLoading}
            onClick={handleSkip}
          >
            나중에 하기
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // step === 'loading'
  return (
    <div className="flex flex-col items-center gap-4">
      <LoadingSpinner />
      <p className="text-sm text-text-2">로그인 처리 중...</p>
    </div>
  );
}

export default function CallbackPage(): ReactNode {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center gap-4">
          <LoadingSpinner />
          <p className="text-sm text-text-2">로그인 처리 중...</p>
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
