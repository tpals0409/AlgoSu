/**
 * @file 문제 상세 + 코드 제출 통합 페이지 (Figma 디자인 반영, i18n 적용)
 * @domain problem, submission
 * @layer page
 * @related problemApi, submissionApi, CodeEditor, messages/problems.json
 */

'use client';

import React, { useState, useEffect, useCallback, use, type ReactNode } from 'react';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ExternalLink,
  Trash2,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { CodeEditor } from '@/components/submission/CodeEditor';
import { AdBanner } from '@/components/ad/AdBanner';
import { AD_SLOTS } from '@/lib/constants/adSlots';
import { problemApi, submissionApi, type Problem, type Submission } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useStudy } from '@/contexts/StudyContext';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useRequireStudy } from '@/hooks/useRequireStudy';
import { DifficultyBadge } from '@/components/ui/DifficultyBadge';
import { SAGA_STEP_CONFIG } from '@/lib/constants';
import type { SagaStep } from '@/lib/constants';


// ─── TYPES ────────────────────────────────

interface PageProps {
  readonly params: Promise<{ id: string }>;
}

/** 요일 키 배열 (getDay() 인덱스 → 번역 키 매핑) */
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;


// ─── RENDER ───────────────────────────────

/**
 * 문제 상세 + 코드 제출 통합 페이지
 * @domain problem, submission
 */
export default function ProblemDetailPage({ params }: PageProps): ReactNode {
  const { id: problemId } = use(params);
  const router = useRouter();
  const t = useTranslations('problems');
  const { isAuthenticated } = useRequireAuth();
  useRequireStudy();
  const { githubConnected } = useAuth();
  const { currentStudyId, currentStudyRole } = useStudy();
  const isAdmin = currentStudyRole === 'ADMIN';

  // ─── STATE ──────────────────────────────

  const [problem, setProblem] = useState<Problem | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 코드 제출 관련
  const [code, setCode] = useState<string>('');
  const [language, setLanguage] = useState<string>('python');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // ESC 키로 삭제 확인 모달 닫기
  useEffect(() => {
    if (!showDeleteConfirm) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowDeleteConfirm(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showDeleteConfirm]);

  const fade = (delay = 0): React.CSSProperties => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(16px)',
    transition: `opacity .5s cubic-bezier(.16,1,.3,1) ${delay}s, transform .5s cubic-bezier(.16,1,.3,1) ${delay}s`,
  });

  // ─── EFFECTS ────────────────────────────

  useEffect(() => {
    if (!isAuthenticated || !currentStudyId) return;
    let cancelled = false;

    const load = async (): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        const [problemData, submissionData] = await Promise.all([
          problemApi.findById(problemId),
          submissionApi.list({ problemId, limit: 100 }).then((r) => r.data).catch(() => [] as Submission[]),
        ]);
        if (cancelled) return;
        setProblem(problemData);
        document.title = `${problemData.title} | AlgoSu`;
        setSubmissions(submissionData);
      } catch (err: unknown) {
        if (!cancelled) {
          setError((err as Error).message ?? t('detail.error'));
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [isAuthenticated, currentStudyId, problemId, t]);

  // ─── HANDLERS ─────────────────────────────

  const handleCodeChange = useCallback((newCode: string): void => {
    setCode(newCode);
  }, []);

  const handleLanguageChange = useCallback((lang: string): void => {
    setLanguage(lang);
  }, []);

  const handleSubmit = useCallback(async (): Promise<void> => {
    if (!problem) return;
    if (!code.trim()) {
      setSubmitError(t('submit.enterCode'));
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const submission = await submissionApi.create({
        problemId: problem.id,
        language,
        code,
      });

      toast.success(t('submit.success'), {
        description: t('submit.successDescription'),
        duration: 3000,
      });
      router.push(`/submissions/${submission.id}/status`);
    } catch (err: unknown) {
      setSubmitError((err as Error).message ?? t('submit.submitError'));
    } finally {
      setIsSubmitting(false);
    }
  }, [problem, language, code, router, t]);

  const handleDelete = useCallback(async (): Promise<void> => {
    setIsDeleting(true);
    try {
      await problemApi.delete(problemId);
      router.push('/problems');
    } catch (err: unknown) {
      setError((err as Error).message ?? t('submit.deleteError'));
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  }, [problemId, router, t]);

  // ─── LOADING ────────────────────────────

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-4">
          <Skeleton height={20} width="30%" />
          <Skeleton height={200} />
          <Skeleton height={300} />
        </div>
      </AppLayout>
    );
  }

  if (error || !problem) {
    return (
      <AppLayout>
        <div className="space-y-4">
          <Alert variant="error">{error ?? t('detail.notFound')}</Alert>
          <Button variant="ghost" size="sm" onClick={() => router.push('/problems')}>
            <ArrowLeft />
            {t('detail.backToList')}
          </Button>
        </div>
      </AppLayout>
    );
  }

  const canSubmit = problem.status === 'ACTIVE' || problem.status === 'CLOSED';
  const isPastDeadline = !!problem.deadline && new Date(problem.deadline) <= new Date();
  const isLateWindow = canSubmit && isPastDeadline;
  const isOngoing = problem.status === 'ACTIVE' && !isPastDeadline;

  // 마감일 포맷 (i18n)
  const deadlineFormatted = problem.deadline
    ? (() => {
        const d = new Date(problem.deadline);
        const dayName = t(`detail.dayNames.${DAY_KEYS[d.getDay()]}`);
        return t('detail.deadlineFormat', {
          month: d.getMonth() + 1,
          day: d.getDate(),
          dayName,
        });
      })()
    : '-';

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* ─── 헤더: ← + 제목 + 삭제 ─── */}
        <div className="flex items-center gap-3" style={fade(0)}>
          <button
            type="button"
            onClick={() => router.push('/problems')}
            className="flex items-center justify-center shrink-0 h-9 w-9 rounded-full transition-colors hover:bg-bg-alt"
          >
            <ArrowLeft className="h-5 w-5" style={{ color: 'var(--text)' }} />
          </button>
          <h1 className="flex-1 text-[22px] font-bold tracking-tight text-text">{problem.title}</h1>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center justify-center shrink-0 h-9 w-9 rounded-full transition-colors hover:bg-bg-alt"
              aria-label={t('detail.deleteProblem')}
            >
              <Trash2 className="h-4 w-4" style={{ color: 'var(--text-3)' }} />
            </button>
          )}
        </div>

        {/* 삭제 확인 모달 */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-black/40" role="presentation" onClick={() => setShowDeleteConfirm(false)} />
            <div className="relative rounded-xl border border-border bg-bg-card p-5 shadow-lg w-[340px] space-y-4">
              <p className="text-[14px] font-semibold text-text">{t('detail.deleteConfirm.title')}</p>
              <p className="text-[13px]" style={{ color: 'var(--text-2)' }}>{t('detail.deleteConfirm.description')}</p>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 rounded-lg text-[13px] font-medium transition-colors hover:bg-bg-alt"
                  style={{ color: 'var(--text-2)' }}
                >
                  {t('detail.deleteConfirm.cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="px-4 py-2 rounded-lg text-[13px] font-medium text-white transition-opacity disabled:opacity-50"
                  style={{ backgroundColor: 'var(--error)' }}
                >
                  {isDeleting ? t('detail.deleteConfirm.deleting') : t('detail.deleteConfirm.delete')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── 2열 레이아웃 (모바일: 1열 스택 / 데스크톱: 좌+우) ─── */}
        <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-start" style={fade(0.1)}>

          {/* ─── 좌측: 문제 정보 + 코드 제출 ─── */}
          <div className="flex-1 min-w-0 space-y-4">

            {/* 문제 정보 카드 */}
            <div className="rounded-xl border border-border p-3 sm:p-5 space-y-3 sm:space-y-4 bg-bg-card">
              {/* 뱃지 줄 */}
              <div className="flex flex-wrap items-center gap-2">
                <DifficultyBadge
                  difficulty={problem.difficulty ?? null}
                  level={problem.level}
                  sourcePlatform={problem.sourcePlatform}
                />
                <span
                  className="inline-flex items-center gap-1 rounded-badge px-2 py-0.5 text-[11px] font-medium"
                  style={
                    isOngoing
                      ? { backgroundColor: 'var(--success-soft)', color: 'var(--success)' }
                      : isLateWindow
                        ? { backgroundColor: 'var(--warning-soft)', color: 'var(--warning)' }
                        : { backgroundColor: 'var(--bg-alt)', color: 'var(--text-3)' }
                  }
                >
                  {isOngoing && <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: 'var(--success)' }} aria-hidden />}
                  {isOngoing ? t('detail.status.inProgress') : isLateWindow ? t('detail.status.lateSubmission') : t('detail.status.finished')}
                </span>
                {problem.tags?.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                    style={{ backgroundColor: 'var(--bg-alt)', color: 'var(--text-2)' }}
                  >
                    {tag}
                  </span>
                ))}
                <span className="text-[11px] font-medium" style={{ color: 'var(--text-3)' }}>
                  {problem.weekNumber}
                </span>
              </div>

              {/* 설명 */}
              {problem.description && (
                <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-2)' }}>
                  {problem.description}
                </p>
              )}

              {/* 출처 링크 */}
              {problem.sourceUrl && (
                <a
                  href={problem.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[12px] font-medium transition-colors hover:underline"
                  style={{ color: 'var(--primary)' }}
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  {t('detail.viewOnPlatform', { platform: problem.sourcePlatform ?? 'BOJ' })}
                </a>
              )}
            </div>

            {/* 코드 제출 (Monaco 에디터) */}
            {canSubmit && (
              <div className="space-y-3">
                {/* 지각 제출 경고 */}
                {isLateWindow && (
                  <Alert variant="warning" title={t('submit.lateWarning.title')}>
                    {t('submit.lateWarning.description')}
                  </Alert>
                )}

                {/* 제출 에러 */}
                {submitError && (
                  <Alert variant="error" onClose={() => setSubmitError(null)}>
                    {submitError}
                  </Alert>
                )}

                {/* GitHub 미연동 안내 */}
                {!githubConnected && (
                  <Alert variant="info" title={t('submit.github.title')}>
                    {t('submit.github.description')}{' '}
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => router.push('/github-link')}
                      className="inline h-auto p-0 text-inherit underline font-medium"
                    >
                      {t('submit.github.link')}
                    </Button>
                  </Alert>
                )}

                <CodeEditor
                  code={code}
                  language={language}
                  onCodeChange={handleCodeChange}
                  onLanguageChange={handleLanguageChange}
                  onSubmit={handleSubmit}
                  isSubmitting={isSubmitting}
                  deadline={problem.deadline}
                  editorHeight="420px"
                  isLate={isLateWindow}
                />
              </div>
            )}

            {/* 마감 안내 */}
            {!canSubmit && (
              <Alert variant="warning" title={t('submit.closed.title')}>
                {t('submit.closed.description')}
              </Alert>
            )}
          </div>

          {/* ─── 우측 사이드바 (모바일: 전체폭 / 데스크톱: 260px) ─── */}
          <div className="w-full lg:w-[260px] shrink-0 space-y-4">

            {/* 마감 정보 */}
            <div className="rounded-xl border border-border p-3 sm:p-5 space-y-3 bg-bg-card">
              <h3 className="text-[14px] font-bold text-text">{t('detail.deadline.title')}</h3>
              <div className="flex items-center justify-between">
                <span className="text-[13px]" style={{ color: 'var(--text-3)' }}>{t('detail.deadline.date')}</span>
                <span className="text-[13px] font-medium text-text">{deadlineFormatted}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px]" style={{ color: 'var(--text-3)' }}>{t('detail.deadline.week')}</span>
                <span className="text-[13px] font-medium text-text">{problem.weekNumber}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px]" style={{ color: 'var(--text-3)' }}>{t('detail.deadline.platform')}</span>
                <span className="text-[13px] font-medium text-text">{problem.sourcePlatform ?? '-'}</span>
              </div>
            </div>

            {/* 제출 현황 */}
            <div className="rounded-xl border border-border p-3 sm:p-5 bg-bg-card">
              <h3 className="text-[14px] font-bold text-text mb-3">{t('detail.submissions.title')}</h3>
              {submissions.length === 0 ? (
                <p className="text-[13px]" style={{ color: 'var(--text-3)' }}>
                  {t('detail.submissions.empty')}
                </p>
              ) : (
                <div className="space-y-2">
                  {submissions.map((s) => {
                    const stepCfg = SAGA_STEP_CONFIG[s.sagaStep as SagaStep];
                    const time = new Date(s.createdAt);
                    const timeStr = `${time.getMonth() + 1}/${time.getDate()} ${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;
                    const variantColors: Record<string, { bg: string; color: string }> = {
                      success: { bg: 'var(--success-soft)', color: 'var(--success)' },
                      warning: { bg: 'var(--warning-soft)', color: 'var(--warning)' },
                      error:   { bg: 'var(--error-soft)',   color: 'var(--error)' },
                      info:    { bg: 'var(--primary-soft)',  color: 'var(--primary)' },
                      muted:   { bg: 'var(--bg-alt)',       color: 'var(--text-3)' },
                    };
                    const vc = variantColors[stepCfg?.variant ?? 'muted'];
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => router.push(`/submissions/${s.id}/status`)}
                        className="flex items-center gap-2 w-full rounded-lg p-2 text-left transition-colors hover:bg-bg-alt"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="inline-flex items-center rounded-badge px-1.5 py-0.5 text-[10px] font-semibold"
                              style={{ backgroundColor: vc.bg, color: vc.color }}
                            >
                              {stepCfg?.label ?? s.sagaStep}
                            </span>
                            <span className="text-[10px] font-medium uppercase" style={{ color: 'var(--text-3)' }}>
                              {s.language}
                            </span>
                            {s.isLate && (
                              <span
                                className="inline-flex items-center rounded-badge px-1.5 py-0.5 text-[10px] font-semibold"
                                style={{ backgroundColor: 'var(--warning-soft)', color: 'var(--warning)' }}
                              >
                                {t('detail.submissions.late')}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-3)' }}>{timeStr}</p>
                        </div>
                        {s.aiScore != null && (
                          <span className="text-[13px] font-bold" style={{ color: s.aiScore >= 80 ? 'var(--success)' : s.aiScore >= 60 ? 'var(--warning)' : 'var(--error)' }}>
                            {t('detail.submissions.scoreUnit', { score: s.aiScore })}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 사이드바 하단 광고 */}
            <AdBanner slot={AD_SLOTS.PROBLEM_DETAIL} />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
