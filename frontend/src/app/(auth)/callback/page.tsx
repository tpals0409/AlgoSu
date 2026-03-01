'use client';

import { Suspense } from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Alert } from '@/components/ui/Alert';
import { setToken } from '@/lib/auth';

/**
 * OAuth 콜백 페이지 — /callback
 *
 * H4: 백엔드가 fragment(#)로 토큰 전달 — URL 히스토리/서버 로그 노출 방지
 *   /callback#access_token=<jwt>&refresh_token=<jwt>&github_connected=true|false
 */
function CallbackContent(): ReactNode {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // H4: fragment에서 파라미터 파싱 (서버 로그에 토큰 노출 방지)
    const hash = window.location.hash.slice(1); // # 제거
    const params = new URLSearchParams(hash);

    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const githubConnected = params.get('github_connected');
    const errorParam = params.get('error');

    if (errorParam) {
      setError('OAuth 인증에 실패했습니다. 다시 시도해주세요.');
      return;
    }

    if (!accessToken) {
      setError('인증 토큰을 받지 못했습니다. 다시 시도해주세요.');
      return;
    }

    // 토큰 저장 (보안 로그 방지: 토큰 값 로깅 금지)
    setToken(accessToken);

    // refresh token 저장
    if (refreshToken) {
      localStorage.setItem('algosu:refresh-token', refreshToken);
    }

    // GitHub 연동 상태 저장
    if (githubConnected !== null) {
      localStorage.setItem('algosu:github-connected', githubConnected);
    }

    if (githubConnected === 'false' || githubConnected === null) {
      router.replace('/github-link');
    } else {
      router.replace('/studies');
    }
  }, [router]);

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
