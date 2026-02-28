'use client';

import { useState, useEffect, use, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle, Clock, ChevronLeft, RotateCcw } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
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
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useSubmissionSSE, mapSSEToSteps, type SSEStatus } from '@/hooks/useSubmissionSSE';
import { submissionApi, type Submission } from '@/lib/api';

interface PageProps {
  readonly params: Promise<{ id: string }>;
}

// ── SSE 상태 → StatusIndicator 매핑 ──

type StepStatus = 'pending' | 'in_progress' | 'done' | 'failed';

interface Step {
  label: string;
  status: StepStatus;
  detail?: string;
}

function StepIcon({ status }: { readonly status: StepStatus }): ReactNode {
  if (status === 'done') {
    return <CheckCircle2 className="h-5 w-5 text-success" aria-hidden />;
  }
  if (status === 'failed') {
    return <XCircle className="h-5 w-5 text-destructive" aria-hidden />;
  }
  if (status === 'in_progress') {
    return <LoadingSpinner size="sm" color="primary" label="" />;
  }
  return <Clock className="h-5 w-5 text-muted-foreground" aria-hidden />;
}

function StepItem({ step, index }: { readonly step: Step; readonly index: number }): ReactNode {
  const statusVariant: Record<StepStatus, 'success' | 'error' | 'warning' | 'info' | 'muted'> = {
    done: 'success',
    failed: 'error',
    in_progress: 'info',
    pending: 'muted',
  };

  return (
    <div className="flex items-start gap-3">
      {/* 스텝 번호 / 아이콘 */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-card">
        {step.status === 'pending' ? (
          <span className="text-xs font-medium text-muted-foreground">{index + 1}</span>
        ) : (
          <StepIcon status={step.status} />
        )}
      </div>

      {/* 내용 */}
      <div className="flex-1 pt-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{step.label}</span>
          <Badge variant={statusVariant[step.status]}>
            {step.status === 'done'
              ? '완료'
              : step.status === 'failed'
                ? '실패'
                : step.status === 'in_progress'
                  ? '진행 중'
                  : '대기 중'}
          </Badge>
        </div>
        {step.detail && (
          <p className="mt-1 text-xs text-muted-foreground">{step.detail}</p>
        )}
      </div>
    </div>
  );
}

function getOverallStatusMessage(status: SSEStatus): {
  title: string;
  description: string;
  variant: 'success' | 'error' | 'warning' | 'info';
} {
  switch (status) {
    case 'done':
      return {
        title: '제출 완료',
        description: 'AI 분석이 완료되었습니다.',
        variant: 'success',
      };
    case 'github_failed':
    case 'github_token_invalid':
      return {
        title: 'GitHub 동기화 실패',
        description:
          status === 'github_token_invalid'
            ? 'GitHub 계정 연동을 다시 확인해주세요.'
            : 'GitHub 동기화 중 오류가 발생했습니다.',
        variant: 'error',
      };
    case 'ai_failed':
      return {
        title: 'AI 분석 실패',
        description: 'AI 분석 중 오류가 발생했습니다.',
        variant: 'error',
      };
    case 'ai_delayed':
      return {
        title: 'AI 분석 지연',
        description: 'AI 분석이 지연되고 있습니다. 잠시 후 다시 확인해주세요.',
        variant: 'warning',
      };
    case 'error':
      return {
        title: '연결 오류',
        description: '실시간 상태 연결에 문제가 발생했습니다. 새로고침해 주세요.',
        variant: 'error',
      };
    default:
      return {
        title: '처리 중',
        description: '제출을 처리하고 있습니다. 잠시 기다려주세요.',
        variant: 'info',
      };
  }
}

const TERMINAL_STATUSES: SSEStatus[] = ['done', 'github_token_invalid', 'ai_failed'];

export default function SubmissionStatusPage({ params }: PageProps): ReactNode {
  const { id: problemId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const submissionId = searchParams.get('submissionId');

  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // SSE 연결
  const { status, disconnect } = useSubmissionSSE(submissionId);
  const steps = mapSSEToSteps(status);
  const isTerminal = TERMINAL_STATUSES.includes(status);
  const overallStatus = getOverallStatusMessage(status);

  // submissionId 없으면 문제 목록으로
  useEffect(() => {
    if (!submissionId) {
      router.replace('/problems');
    }
  }, [submissionId, router]);

  // 제출 정보 로드
  useEffect(() => {
    if (!submissionId) return;

    const load = async (): Promise<void> => {
      try {
        const data = await submissionApi.findById(submissionId);
        setSubmission(data);
      } catch (err: unknown) {
        setLoadError((err as Error).message ?? '제출 정보를 불러오는 데 실패했습니다.');
      }
    };

    void load();
  }, [submissionId]);

  // 완료 시 SSE 연결 해제는 hook 내부에서 자동 처리

  if (!submissionId) {
    return null;
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-xl space-y-6">
        {/* 뒤로가기 */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/problems/${problemId}`)}
          className="-ml-1"
        >
          <ChevronLeft />
          문제로 돌아가기
        </Button>

        {/* 메인 카드 */}
        <Card>
          <CardHeader>
            <CardTitle>제출 상태</CardTitle>
            <CardDescription>
              {submission
                ? `${submission.language} · ${new Date(submission.createdAt).toLocaleString('ko-KR')}`
                : '제출 정보를 불러오는 중...'}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* 로드 에러 */}
            {loadError && <Alert variant="error">{loadError}</Alert>}

            {/* 전체 상태 알림 (터미널 상태에만 표시) */}
            {isTerminal && (
              <Alert variant={overallStatus.variant} title={overallStatus.title}>
                {overallStatus.description}
              </Alert>
            )}

            {/* 진행 중 알림 */}
            {!isTerminal && status !== 'error' && (
              <Alert variant={overallStatus.variant} title={overallStatus.title}>
                {overallStatus.description}
              </Alert>
            )}

            {/* 연결 오류 */}
            {status === 'error' && (
              <Alert variant="error" title="연결 오류">
                실시간 상태를 받을 수 없습니다. 페이지를 새로고침해 주세요.
              </Alert>
            )}

            {/* 스텝 목록 */}
            <div className="space-y-4">
              {steps.map((step, index) => (
                <StepItem key={step.label} step={step} index={index} />
              ))}
            </div>

            {/* 제출 ID 참조 */}
            <div className="rounded-md bg-muted px-3 py-2">
              <span className="text-xs text-muted-foreground">
                제출 ID: <span className="font-mono">{submissionId}</span>
              </span>
            </div>
          </CardContent>

          <CardFooter className="gap-3">
            {/* 완료 후 버튼 */}
            {isTerminal && (
              <>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => router.push('/problems')}
                >
                  문제 목록으로
                </Button>
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => router.push(`/problems/${problemId}`)}
                >
                  다시 제출
                </Button>
              </>
            )}

            {/* 연결 오류 시 새로고침 */}
            {status === 'error' && (
              <Button
                variant="outline"
                size="md"
                onClick={() => {
                  disconnect();
                  router.refresh();
                }}
              >
                <RotateCcw />
                새로고침
              </Button>
            )}

            {/* 진행 중 */}
            {!isTerminal && status !== 'error' && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <LoadingSpinner size="sm" color="primary" />
                실시간으로 업데이트 중...
              </div>
            )}
          </CardFooter>
        </Card>
      </div>
    </AppLayout>
  );
}
