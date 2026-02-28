'use client';

import { useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { InlineSpinner } from '@/components/ui/LoadingSpinner';
import { authApi } from '@/lib/api';

export default function GitHubLinkPage(): ReactNode {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLinkGitHub = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      const { url } = await authApi.linkGitHub();
      window.location.href = url;
    } catch {
      setError('GitHub 연동 서비스에 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
      setIsLoading(false);
    }
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>GitHub 계정 연동</CardTitle>
        <CardDescription>
          AlgoSu의 코드 제출 기능을 사용하려면 GitHub 계정 연동이 필요합니다.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <Alert variant="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <ul className="space-y-2 rounded-card bg-bg2 p-4 text-sm text-text2">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500" aria-hidden />
            코드 제출 시 GitHub 레포지토리에 자동으로 Push됩니다.
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500" aria-hidden />
            스터디 팀원들과 코드를 공유하고 AI 분석 결과를 받을 수 있습니다.
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500" aria-hidden />
            GitHub 연동 없이는 문제 조회만 가능합니다.
          </li>
        </ul>
      </CardContent>

      <CardFooter className="flex-col gap-3">
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          disabled={isLoading}
          onClick={() => void handleLinkGitHub()}
        >
          {isLoading ? (
            <>
              <InlineSpinner />
              연결 중...
            </>
          ) : (
            'GitHub 계정 연동하기'
          )}
        </Button>
        <p className="text-center text-[11px] text-text3">
          연동은 언제든지 설정에서 해제할 수 있습니다.
        </p>
      </CardFooter>
    </Card>
  );
}
