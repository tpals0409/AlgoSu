'use client';

import { Suspense } from 'react';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Alert } from '@/components/ui/Alert';
import { setToken } from '@/lib/auth';

/**
 * OAuth 콜백 페이지 — /callback
 *
 * 백엔드가 리다이렉트할 때 URL 쿼리로 토큰을 전달:
 *   /callback?token=<jwt>&github_connected=true|false
 */
function CallbackContent(): ReactNode {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    const githubConnected = searchParams.get('github_connected');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      setError('OAuth 인증에 실패했습니다. 다시 시도해주세요.');
      return;
    }

    if (!token) {
      setError('인증 토큰을 받지 못했습니다. 다시 시도해주세요.');
      return;
    }

    // 토큰 저장 (보안 로그 방지: 토큰 값 로깅 금지)
    setToken(token);

    if (githubConnected === 'false' || githubConnected === null) {
      router.replace('/github-link');
    } else {
      router.replace('/studies');
    }
  }, [searchParams, router]);

  if (error) {
    return (
      <div className="w-full max-w-md space-y-4">
        <Alert variant="error">
          {error}
        </Alert>
        <div className="text-center">
          <a href="/login" className="text-sm text-primary-500 underline-offset-4 hover:text-primary-400 hover:underline">
            로그인 페이지로 돌아가기
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <LoadingSpinner />
      <p className="text-sm text-text2">로그인 처리 중...</p>
    </div>
  );
}

export default function CallbackPage(): ReactNode {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center gap-4">
          <LoadingSpinner />
          <p className="text-sm text-text2">로그인 처리 중...</p>
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
