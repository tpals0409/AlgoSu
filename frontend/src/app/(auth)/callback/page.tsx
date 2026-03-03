'use client';

import { Suspense } from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Alert } from '@/components/ui/Alert';
import { useAuth } from '@/contexts/AuthContext';
import { setGitHubConnected } from '@/lib/auth';

/**
 * @file OAuth 콜백 페이지 — /callback
 * @domain identity
 * @layer page
 * @related OAuthController, AuthContext
 *
 * 백엔드가 httpOnly Cookie로 JWT를 설정하고, github_connected만 fragment로 전달.
 * /callback#github_connected=true|false
 */
function CallbackContent(): ReactNode {
  const router = useRouter();
  const { loginFromCookie } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);

    const githubConnected = params.get('github_connected');
    const errorParam = params.get('error');

    if (errorParam) {
      setError('OAuth 인증에 실패했습니다. 다시 시도해주세요.');
      return;
    }

    // httpOnly Cookie로 JWT가 이미 설정됨 — AuthContext에 알림
    loginFromCookie();

    // GitHub 연동 상태 저장
    if (githubConnected !== null) {
      setGitHubConnected(githubConnected === 'true');
    }

    if (githubConnected === 'false' || githubConnected === null) {
      router.replace('/github-link');
    } else {
      router.replace('/studies');
    }
  }, [router, loginFromCookie]);

  if (error) {
    return (
      <div className="w-full max-w-md space-y-4">
        <Alert variant="error">
          {error}
        </Alert>
        <div className="text-center">
          <a href="/login" className="text-sm text-primary underline-offset-4 hover:text-primary-light hover:underline">
            로그인 페이지로 돌아가기
          </a>
        </div>
      </div>
    );
  }

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
