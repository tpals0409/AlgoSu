/**
 * @file 제출 상태 페이지 (SSE 실시간 업데이트)
 * @domain submission
 * @layer page
 * @related useSubmissionSSE, submissionApi, Badge, AppLayout
 */

'use client';

import { useState, useEffect, use, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, XCircle, Clock, ChevronLeft, RotateCcw, ArrowRight } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useSubmissionSSE, mapSSEToSteps, type SSEStatus } from '@/hooks/useSubmissionSSE';
import { submissionApi, type Submission } from '@/lib/api';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useRequireStudy } from '@/hooks/useRequireStudy';

// ─── TYPES ────────────────────────────────

interface PageProps {
  readonly params: Promise<{ id: string }>;
}

type StepStatus = 'pending' | 'in_progress' | 'done' | 'failed';

interface Step {
  label: string;
  status: StepStatus;
  detail?: string;
}

// ─── HELPERS ──────────────────────────────

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

// ─── STEP COMPONENTS ─────────────────────

function StepIcon({ status }: { readonly status: StepStatus }): ReactNode {
  if (status === 'done') {
    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-success-soft">
        <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />
      </div>
    );
  }
  if (status === 'failed') {
    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-error-soft">
        <XCircle className="h-4 w-4 text-error" aria-hidden />
      </div>
    );
  }
  if (status === 'in_progress') {
    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary-soft">
        <LoadingSpinner size="sm" color="primary" label="" />
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center w-8 h-8 rounded-full border border-border bg-bg-card">
      <Clock className="h-4 w-4 text-text-3" aria-hidden />
    </div>
  );
}

function StepItem({ step, isLast }: { readonly step: Step; readonly isLast: boolean }): ReactNode {
  const statusVariant: Record<StepStatus, 'success' | 'error' | 'warning' | 'info' | 'muted'> = {
    done: 'success',
    failed: 'error',
    in_progress: 'info',
    pending: 'muted',
  };

  const statusLabel: Record<StepStatus, string> = {
    done: '완료',
    failed: '실패',
    in_progress: '진행 중',
    pending: '대기 중',
  };

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <StepIcon status={step.status} />
        {!isLast && (
          <div className={`w-px flex-1 mt-1.5 ${step.status === 'done' ? 'bg-success/30' : 'bg-border'}`} />
        )}
      </div>

      <div className={`flex-1 ${isLast ? 'pb-0' : 'pb-6'}`}>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${step.status === 'pending' ? 'text-text-3' : 'text-text'}`}>
            {step.label}
          </span>
          <Badge variant={statusVariant[step.status]}>
            {statusLabel[step.status]}
          </Badge>
        </div>
        {step.detail && (
          <p className="mt-1 text-[11px] text-text-3">{step.detail}</p>
        )}
      </div>
    </div>
  );
}

// ─── RENDER ───────────────────────────────

/**
 * 제출 상태 페이지 — /submissions/[id]/status
 * SSE로 실시간 상태 업데이트
 * @domain submission
 */
export default function SubmissionStatusPage({ params }: PageProps): ReactNode {
  const { id: submissionId } = use(params);
  const router = useRouter();
  const { isAuthenticated } = useRequireAuth();
  useRequireStudy();

  // ─── STATE ──────────────────────────────

  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // SSE
  const { status, disconnect } = useSubmissionSSE(submissionId);
  const steps = mapSSEToSteps(status);
  const isTerminal = TERMINAL_STATUSES.includes(status);
  const overallStatus = getOverallStatusMessage(status);

  // ─── EFFECTS ────────────────────────────

  useEffect(() => {
    if (!submissionId || !isAuthenticated) return;

    const load = async (): Promise<void> => {
      try {
        const data = await submissionApi.findById(submissionId);
        setSubmission(data);
      } catch (err: unknown) {
        setLoadError((err as Error).message ?? '제출 정보를 불러오는 데 실패했습니다.');
      }
    };

    void load();
  }, [submissionId, isAuthenticated]);

  return (
    <AppLayout>
      <div className="mx-auto max-w-xl space-y-4">
        {/* 뒤로가기 */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (submission?.problemId) {
              router.push(`/problems/${submission.problemId}`);
            } else {
              router.push('/problems');
            }
          }}
          className="-ml-1"
        >
          <ChevronLeft />
          문제로 돌아가기
        </Button>

        {/* 메인 카드 */}
        <Card>
          <CardHeader>
            <CardTitle>제출 상태</CardTitle>
            <p className="mt-0.5 font-mono text-[10px] text-text-3">
              {submission
                ? `${submission.language} / ${new Date(submission.createdAt).toLocaleString('ko-KR')}`
                : '제출 정보를 불러오는 중...'}
            </p>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* 로드 에러 */}
            {loadError && <Alert variant="error">{loadError}</Alert>}

            {/* 상태 알림 */}
            <Alert variant={overallStatus.variant} title={overallStatus.title}>
              {overallStatus.description}
            </Alert>

            {/* 스텝 목록 */}
            <div className="pt-1">
              {steps.map((step, index) => (
                <StepItem
                  key={step.label}
                  step={step}
                  isLast={index === steps.length - 1}
                />
              ))}
            </div>

            {/* 제출 ID */}
            <div className="rounded-btn bg-bg-alt px-3 py-2">
              <span className="text-[11px] text-text-3">
                제출 ID: <span className="font-mono">{submissionId.slice(0, 12)}...</span>
              </span>
            </div>
          </CardContent>
        </Card>

        {/* 완료 후 액션 버튼 */}
        {isTerminal && (
          <div className="flex gap-3">
            {submission?.problemId && (
              <Button
                variant="ghost"
                size="lg"
                className="flex-1"
                onClick={() => router.push(`/problems/${submission.problemId}`)}
              >
                다시 제출
              </Button>
            )}
            {status === 'done' && (
              <Button
                variant="primary"
                size="lg"
                className="flex-1"
                onClick={() => router.push(`/submissions/${submissionId}/analysis`)}
              >
                AI 분석 보기
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
            {status !== 'done' && (
              <Button
                variant="primary"
                size="lg"
                className="flex-1"
                onClick={() => router.push('/problems')}
              >
                문제 목록으로
              </Button>
            )}
          </div>
        )}

        {/* 연결 오류 시 새로고침 */}
        {status === 'error' && (
          <Button
            variant="ghost"
            size="lg"
            className="w-full"
            onClick={() => {
              disconnect();
              router.refresh();
            }}
          >
            <RotateCcw className="h-4 w-4" />
            새로고침
          </Button>
        )}

        {/* 진행 중 */}
        {!isTerminal && status !== 'error' && (
          <div className="flex items-center justify-center gap-2 text-[11px] text-text-3">
            <LoadingSpinner size="sm" color="primary" />
            실시간으로 업데이트 중...
          </div>
        )}
      </div>
    </AppLayout>
  );
}
