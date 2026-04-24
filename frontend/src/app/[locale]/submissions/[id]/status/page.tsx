/**
 * @file 제출 상태 페이지 (SSE 실시간 업데이트, i18n 적용)
 * @domain submission
 * @layer page
 * @related useSubmissionSSE, submissionApi, Badge, AppLayout, messages/submissions.json
 */

'use client';

import { useState, useEffect, use, type ReactNode } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { CheckCircle2, XCircle, Clock, ChevronLeft, RotateCcw, ArrowRight, Sparkles, LinkIcon } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useSubmissionSSE, mapSSEToSteps, type SSEStatus } from '@/hooks/useSubmissionSSE';
import { useAiQuota } from '@/hooks/useAiQuota';
import { submissionApi, authApi, type Submission } from '@/lib/api';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useRequireStudy } from '@/hooks/useRequireStudy';
import { useStudy } from '@/contexts/StudyContext';

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

/** SSE status → i18n 키 매핑 */
const OVERALL_STATUS_MAP: Record<string, { titleKey: string; descKey: string; variant: 'success' | 'error' | 'warning' | 'info' }> = {
  done: { titleKey: 'status.overall.done.title', descKey: 'status.overall.done.description', variant: 'success' },
  github_token_invalid: { titleKey: 'status.overall.githubTokenInvalid.title', descKey: 'status.overall.githubTokenInvalid.description', variant: 'error' },
  ai_failed: { titleKey: 'status.overall.aiFailed.title', descKey: 'status.overall.aiFailed.description', variant: 'error' },
  ai_delayed: { titleKey: 'status.overall.aiDelayed.title', descKey: 'status.overall.aiDelayed.description', variant: 'warning' },
  error: { titleKey: 'status.overall.error.title', descKey: 'status.overall.error.description', variant: 'error' },
};

const DEFAULT_OVERALL = { titleKey: 'status.overall.processing.title', descKey: 'status.overall.processing.description', variant: 'info' as const };

/** StepStatus → i18n 키 매핑 */
const STEP_STATUS_KEYS: Record<StepStatus, string> = {
  done: 'status.stepStatus.done',
  failed: 'status.stepStatus.failed',
  in_progress: 'status.stepStatus.inProgress',
  pending: 'status.stepStatus.pending',
};

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

function StepItem({ step, isLast, statusLabel }: { readonly step: Step; readonly isLast: boolean; readonly statusLabel: string }): ReactNode {
  const statusVariant: Record<StepStatus, 'success' | 'error' | 'warning' | 'info' | 'muted'> = {
    done: 'success',
    failed: 'error',
    in_progress: 'info',
    pending: 'muted',
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
            {statusLabel}
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
  const t = useTranslations('submissions');
  const locale = useLocale();
  const { isAuthenticated } = useRequireAuth();
  useRequireStudy();
  const { currentStudyId } = useStudy();
  const { quota } = useAiQuota(isAuthenticated);

  // ─── STATE ──────────────────────────────

  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [relinkLoading, setRelinkLoading] = useState(false);

  // 이미 최종 상태인 제출에는 SSE 연결 불필요
  const isAlreadyTerminal = submission?.sagaStep === 'DONE' || submission?.sagaStep === 'FAILED';
  const sseSubmissionId = initialLoaded && !isAlreadyTerminal ? submissionId : null;

  // SSE
  const { status: sseStatus, disconnect } = useSubmissionSSE(sseSubmissionId);

  // 이미 최종 상태인 제출은 sagaStep 기반으로 상태 표시
  const status: SSEStatus = isAlreadyTerminal
    ? (submission?.sagaStep === 'DONE' ? 'done' : 'ai_failed')
    : sseStatus;

  const steps = mapSSEToSteps(status);
  const isTerminal = TERMINAL_STATUSES.includes(status);
  const overallMap = OVERALL_STATUS_MAP[status] ?? DEFAULT_OVERALL;

  // ─── EFFECTS ────────────────────────────

  useEffect(() => {
    if (!submissionId || !isAuthenticated || !currentStudyId) return;

    const load = async (): Promise<void> => {
      try {
        const data = await submissionApi.findById(submissionId);
        setSubmission(data);
      } catch (err: unknown) {
        setLoadError((err as Error).message ?? t('status.loadError'));
      } finally {
        setInitialLoaded(true);
      }
    };

    void load();
  }, [submissionId, isAuthenticated, currentStudyId, t]);

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
          {t('status.backToProblem')}
        </Button>

        {/* 메인 카드 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{t('status.heading')}</CardTitle>
              {quota && (
                <Badge
                  variant={quota.remaining > 0 ? 'muted' : 'warning'}
                  className="flex items-center gap-1.5"
                >
                  <Sparkles className="h-3 w-3" aria-hidden />
                  {t('status.aiQuota', { used: quota.used, limit: quota.limit })}
                </Badge>
              )}
            </div>
            <p className="mt-0.5 font-mono text-[10px] text-text-3">
              {submission
                ? `${submission.language} / ${new Date(submission.createdAt).toLocaleString(locale)}`
                : t('status.loadingInfo')}
            </p>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* 로드 에러 */}
            {loadError && <Alert variant="error">{loadError}</Alert>}

            {/* 상태 알림 */}
            <Alert variant={overallMap.variant} title={t(overallMap.titleKey)}>
              {t(overallMap.descKey)}
            </Alert>

            {/* 스텝 목록 */}
            <div className="pt-1">
              {steps.map((step, index) => (
                <StepItem
                  key={step.label}
                  step={step}
                  isLast={index === steps.length - 1}
                  statusLabel={t(STEP_STATUS_KEYS[step.status])}
                />
              ))}
            </div>

            {/* 제출 ID */}
            <div className="rounded-btn bg-bg-alt px-3 py-2">
              <span className="text-[11px] text-text-3">
                {t('status.submissionId')}: <span className="font-mono">{submissionId.slice(0, 12)}...</span>
              </span>
            </div>
          </CardContent>
        </Card>

        {/* TOKEN_INVALID: GitHub 재연동 안내 */}
        {status === 'github_token_invalid' && (
          <Card>
            <CardContent className="flex items-start gap-3 py-4">
              <div className="flex items-center justify-center w-8 h-8 shrink-0 rounded-full bg-warning-soft">
                <LinkIcon className="h-4 w-4 text-warning" aria-hidden />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text">
                  {t('status.github.relinkNeeded')}
                </p>
                <p className="mt-1 text-[11px] text-text-3 leading-relaxed">
                  {t('status.github.relinkDescription')}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={relinkLoading}
                    onClick={async () => {
                      setRelinkLoading(true);
                      try {
                        const { url } = await authApi.relinkGitHub();
                        window.location.href = url;
                      } catch {
                        setRelinkLoading(false);
                      }
                    }}
                  >
                    {relinkLoading ? t('status.github.relinking') : t('status.github.relink')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push('/profile')}
                  >
                    {t('status.github.profileSettings')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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
                {t('status.actions.resubmit')}
              </Button>
            )}
            {status === 'done' && (
              <Button
                variant="primary"
                size="lg"
                className="flex-1"
                onClick={() => router.push(`/submissions/${submissionId}/analysis`)}
              >
                {t('status.actions.viewAnalysis')}
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
                {t('status.actions.problemList')}
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
            {t('status.actions.refresh')}
          </Button>
        )}

        {/* 진행 중 */}
        {!isTerminal && status !== 'error' && (
          <div className="flex items-center justify-center gap-2 text-[11px] text-text-3">
            <LoadingSpinner size="sm" color="primary" />
            {t('status.actions.updatingRealtime')}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
