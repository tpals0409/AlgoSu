/**
 * @file OAuth 콜백 페이지 (i18n 번역 적용)
 * @domain identity
 * @layer page
 * @related OAuthController, AuthContext, @/i18n/navigation
 *
 * 백엔드가 httpOnly Cookie로 JWT를 설정하고, github_connected만 fragment로 전달.
 * /callback#github_connected=true|false
 *
 * github_connected=false 시 GitHub 연동 선택 UI를 인라인으로 표시.
 * useTranslations('auth') 훅으로 모든 UI 문자열을 번역 키로 참조한다.
 */

'use client';

import { Suspense } from 'react';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
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
import { authApi } from '@/lib/api';

type CallbackStep = 'loading' | 'error' | 'github-prompt';

/** OAuth 에러 코드 → 번역 키 매핑 화이트리스트 */
const ERROR_KEY_MAP: Record<string, string> = {
  invalid_state: 'errors.invalidState',
  missing_code: 'errors.missingCode',
  provider_denied: 'errors.providerDenied',
  account_conflict: 'errors.accountConflict',
  email_in_use: 'errors.accountConflict',
};

function CallbackContent(): ReactNode {
  const t = useTranslations('auth');
  const router = useRouter();
  const { loginFromCookie, updateGitHubStatus } = useAuth();
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
      // 화이트리스트 매핑 → 번역 키, 미등록 코드 → 일반 실패 메시지 (i18n 안전)
      const mappedKey = ERROR_KEY_MAP[decoded];
      setError(mappedKey ? t(mappedKey) : t('errors.oauthFailed'));
      setStep('error');
      return;
    }

    // httpOnly Cookie로 JWT가 이미 설정됨 — AuthContext에 알림
    loginFromCookie();

    // GitHub 연동 상태 저장 (AuthContext SSoT)
    if (githubConnected !== null) {
      updateGitHubStatus(githubConnected === 'true');
    }

    if (githubConnected === 'false') {
      setStep('github-prompt');
    } else {
      // github_connected=true 또는 파라미터 없음 → 홈으로
      router.replace('/');
    }
  }, [router, loginFromCookie, updateGitHubStatus, t]);

  /** GitHub 연동 핸들러 */
  const handleLinkGitHub = useCallback(async () => {
    setLinkError(null);
    setLinkLoading(true);
    try {
      const { url } = await authApi.linkGitHub();
      window.location.href = url;
    } catch {
      setLinkError(t('errors.githubLinkFailed'));
      setLinkLoading(false);
    }
  }, [t]);

  /** 건너뛰기 핸들러 */
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
            {t('callback.backToLogin')}
          </Link>
        </div>
      </div>
    );
  }

  if (step === 'github-prompt') {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{t('callback.github.title')}</CardTitle>
          <CardDescription>
            {t('callback.github.description')}
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
              {t('callback.github.benefit1')}
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
              {t('callback.github.benefit2')}
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
              {t('callback.github.benefit3')}
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
                {t('callback.github.linking')}
              </>
            ) : (
              t('callback.github.linkButton')
            )}
          </Button>
          <Button
            variant="ghost"
            size="md"
            className="w-full"
            disabled={linkLoading}
            onClick={handleSkip}
          >
            {t('callback.github.skipButton')}
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // step === 'loading'
  return (
    <div className="flex flex-col items-center gap-4">
      <LoadingSpinner />
      <p className="text-sm text-text-2">{t('callback.loading')}</p>
    </div>
  );
}

export default function CallbackPage(): ReactNode {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center gap-4">
          <LoadingSpinner />
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
