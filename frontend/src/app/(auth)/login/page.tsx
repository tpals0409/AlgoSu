'use client';

import { useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { InlineSpinner } from '@/components/ui/LoadingSpinner';
import { authApi } from '@/lib/api';

type OAuthProvider = 'google' | 'naver' | 'kakao';

interface ProviderConfig {
  id: OAuthProvider;
  label: string;
  icon: string;
}

const PROVIDERS: ProviderConfig[] = [
  { id: 'google', label: 'Google로 시작하기', icon: 'G' },
  { id: 'naver', label: 'Naver로 시작하기', icon: 'N' },
  { id: 'kakao', label: 'Kakao로 시작하기', icon: 'K' },
];

export default function LoginPage(): ReactNode {
  const [error, setError] = useState<string | null>(null);
  const [loadingProvider, setLoadingProvider] = useState<OAuthProvider | null>(null);

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

  return (
    <Card>
      <CardHeader>
        <CardTitle>시작하기</CardTitle>
        <CardDescription>소셜 계정으로 AlgoSu에 가입하거나 로그인하세요.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {error && (
          <Alert variant="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {PROVIDERS.map(({ id, label, icon }) => {
          const isLoading = loadingProvider === id;
          const isDisabled = loadingProvider !== null;
          return (
            <Button
              key={id}
              variant="outline"
              size="lg"
              className="w-full justify-start gap-3"
              disabled={isDisabled}
              onClick={() => void handleOAuth(id)}
            >
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-500 text-white"
                style={{ fontSize: '11px', fontWeight: 700 }}
                aria-hidden
              >
                {icon}
              </span>
              {isLoading ? (
                <>
                  <InlineSpinner />
                  연결 중...
                </>
              ) : (
                label
              )}
            </Button>
          );
        })}

        <p className="pt-1 text-center text-[11px] text-text3">
          가입 시 AlgoSu 서비스 약관 및 개인정보 처리방침에 동의하게 됩니다.
        </p>
      </CardContent>
    </Card>
  );
}
