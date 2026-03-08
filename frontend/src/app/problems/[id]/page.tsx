/**
 * @file 문제 상세 + 코드 제출 통합 페이지 (Figma 디자인 반영)
 * @domain problem, submission
 * @layer page
 * @related problemApi, submissionApi, draftApi, CodeEditor, useAutoSave
 */

'use client';

import React, { useState, useEffect, useCallback, use, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ExternalLink,
  Trash2,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { CodeEditor } from '@/components/submission/CodeEditor';
import { useAutoSave } from '@/hooks/useAutoSave';
import { problemApi, submissionApi, draftApi, type Problem, type Submission } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useStudy } from '@/contexts/StudyContext';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useRequireStudy } from '@/hooks/useRequireStudy';
import { DIFFICULTY_LABELS, SAGA_STEP_CONFIG, toTierLevel } from '@/lib/constants';
import type { Difficulty, SagaStep } from '@/lib/constants';

// ─── DIFFICULTY STYLES (CSS 변수 기반, 대시보드 패턴 통일) ────

const DIFF_DOT_STYLE: Record<string, React.CSSProperties> = {
  bronze:   { backgroundColor: 'var(--diff-bronze-color)' },
  silver:   { backgroundColor: 'var(--diff-silver-color)' },
  gold:     { backgroundColor: 'var(--diff-gold-color)' },
  platinum: { backgroundColor: 'var(--diff-platinum-color)' },
  diamond:  { backgroundColor: 'var(--diff-diamond-color)' },
  ruby:     { backgroundColor: 'var(--diff-ruby-color)' },
};

const DIFF_BADGE_STYLE: Record<string, React.CSSProperties> = {
  bronze:   { backgroundColor: 'var(--diff-bronze-bg)',   color: 'var(--diff-bronze-color)' },
  silver:   { backgroundColor: 'var(--diff-silver-bg)',   color: 'var(--diff-silver-color)' },
  gold:     { backgroundColor: 'var(--diff-gold-bg)',     color: 'var(--diff-gold-color)' },
  platinum: { backgroundColor: 'var(--diff-platinum-bg)', color: 'var(--diff-platinum-color)' },
  diamond:  { backgroundColor: 'var(--diff-diamond-bg)',  color: 'var(--diff-diamond-color)' },
  ruby:     { backgroundColor: 'var(--diff-ruby-bg)',     color: 'var(--diff-ruby-color)' },
};

// ─── TYPES ────────────────────────────────

interface PageProps {
  readonly params: Promise<{ id: string }>;
}

type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

// ─── RENDER ───────────────────────────────

/**
 * 문제 상세 + 코드 제출 통합 페이지
 * @domain problem, submission
 */
export default function ProblemDetailPage({ params }: PageProps): ReactNode {
  const { id: problemId } = use(params);
  const router = useRouter();
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
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>('idle');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

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
        const [problemData, draftData, submissionData] = await Promise.all([
          problemApi.findById(problemId),
          draftApi.find(problemId).catch(() => null),
          submissionApi.listByProblemForStudy(problemId).catch(() => [] as Submission[]),
        ]);
        if (cancelled) return;
        setProblem(problemData);
        setSubmissions(submissionData);
        if (draftData) {
          setCode(draftData.code);
          setLanguage(draftData.language);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError((err as Error).message ?? '문제를 불러오는 데 실패했습니다.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [isAuthenticated, currentStudyId, problemId]);

  // ─── AUTO-SAVE ──────────────────────────

  const { loadFromLocal, clearLocal } = useAutoSave({
    problemId,
    studyId: currentStudyId,
    code,
    language,
    onLocalSaved: useCallback(() => {
      setAutoSaveStatus('saved');
      setTimeout(() => setAutoSaveStatus('idle'), 2000);
    }, []),
    onSaveFailed: useCallback(() => {
      setAutoSaveStatus('error');
      setTimeout(() => setAutoSaveStatus('idle'), 3000);
    }, []),
    onServerSave: useCallback(
      async (data: { code: string; language: string }): Promise<void> => {
        try {
          await draftApi.upsert(problemId, { language: data.language, code: data.code });
        } catch {
          // 서버 저장 실패 — localStorage에 이미 저장됨
        }
      },
      [problemId],
    ),
    enabled: !isLoading && problem !== null && problem.status === 'ACTIVE',
  });

  useEffect(() => {
    if (isLoading || code) return;
    const local = loadFromLocal();
    if (local) {
      setCode(local.code);
      setLanguage(local.language);
    }
  }, [isLoading, code, loadFromLocal]);

  // ─── HANDLERS ─────────────────────────────

  const handleCodeChange = useCallback((newCode: string): void => {
    setCode(newCode);
    setAutoSaveStatus('saving');
  }, []);

  const handleLanguageChange = useCallback((lang: string): void => {
    setLanguage(lang);
    setAutoSaveStatus('saving');
  }, []);

  const handleSubmit = useCallback(async (): Promise<void> => {
    if (!problem) return;
    if (!code.trim()) {
      setSubmitError('코드를 입력해주세요.');
      return;
    }
    if (!githubConnected) {
      setSubmitError('GitHub 계정을 먼저 연동해주세요.');
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

      clearLocal();
      void draftApi.remove(problemId).catch(() => {});

      router.push(`/submissions/${submission.id}/status`);
    } catch (err: unknown) {
      setSubmitError((err as Error).message ?? '제출 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  }, [problem, language, code, problemId, clearLocal, router, githubConnected]);

  const handleDelete = useCallback(async (): Promise<void> => {
    setIsDeleting(true);
    try {
      await problemApi.delete(problemId);
      router.push('/problems');
    } catch (err: unknown) {
      setError((err as Error).message ?? '삭제 중 오류가 발생했습니다.');
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  }, [problemId, router]);

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
          <Alert variant="error">{error ?? '문제를 찾을 수 없습니다.'}</Alert>
          <Button variant="ghost" size="sm" onClick={() => router.push('/problems')}>
            <ArrowLeft />
            문제 목록
          </Button>
        </div>
      </AppLayout>
    );
  }

  const isActive = problem.status === 'ACTIVE' && (!problem.deadline || new Date(problem.deadline) > new Date());
  const diffKey = problem.difficulty ? (problem.difficulty as string).toLowerCase() : '';
  const diffLabel = problem.difficulty
    ? `${DIFFICULTY_LABELS[problem.difficulty as Difficulty] ?? problem.difficulty}${toTierLevel(problem.level) ? ` ${toTierLevel(problem.level)}` : ''}`
    : '';

  // 마감일 포맷
  const deadlineFormatted = problem.deadline
    ? (() => {
        const d = new Date(problem.deadline);
        const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
        return `${d.getMonth() + 1}월 ${d.getDate()}일 (${dayNames[d.getDay()]})`;
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
              aria-label="문제 삭제"
            >
              <Trash2 className="h-4 w-4" style={{ color: 'var(--text-3)' }} />
            </button>
          )}
        </div>

        {/* 삭제 확인 */}
        {showDeleteConfirm && (
          <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: 'var(--error)', backgroundColor: 'var(--error-soft)' }}>
            <p className="text-[13px] font-medium" style={{ color: 'var(--error)' }}>
              이 문제를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-3 py-1.5 rounded-lg text-[13px] font-medium text-white transition-opacity disabled:opacity-50"
                style={{ backgroundColor: 'var(--error)' }}
              >
                {isDeleting ? '삭제 중...' : '삭제'}
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors hover:bg-bg-alt"
                style={{ color: 'var(--text-2)' }}
              >
                취소
              </button>
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
                {diffLabel && (
                  <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium" style={DIFF_BADGE_STYLE[diffKey] ?? {}}>
                    <span className="h-1.5 w-1.5 rounded-full" style={DIFF_DOT_STYLE[diffKey] ?? {}} aria-hidden />
                    {diffLabel}
                  </span>
                )}
                <span
                  className="inline-flex items-center gap-1 rounded-badge px-2 py-0.5 text-[11px] font-medium"
                  style={
                    isActive
                      ? { backgroundColor: 'var(--success-soft)', color: 'var(--success)' }
                      : { backgroundColor: 'var(--bg-alt)', color: 'var(--text-3)' }
                  }
                >
                  {isActive && <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: 'var(--success)' }} aria-hidden />}
                  {isActive ? '진행 중' : '종료'}
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
                  {problem.sourcePlatform ?? 'BOJ'}에서 문제 보기
                </a>
              )}
            </div>

            {/* 코드 제출 (Monaco 에디터) */}
            {isActive && (
              <div className="space-y-3">
                {/* 제출 에러 */}
                {submitError && (
                  <Alert variant="error" onClose={() => setSubmitError(null)}>
                    {submitError}
                  </Alert>
                )}

                {/* GitHub 미연동 경고 */}
                {!githubConnected && (
                  <Alert variant="warning" title="GitHub 연동 필요">
                    코드를 제출하려면 먼저 GitHub 계정을 연동해주세요.{' '}
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => router.push('/github-link')}
                      className="inline h-auto p-0 text-inherit underline font-medium"
                    >
                      GitHub 연동하기
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
                  autoSaveStatus={autoSaveStatus}
                  deadline={problem.deadline}
                  editorHeight="420px"
                />
              </div>
            )}

            {/* 마감 안내 */}
            {!isActive && (
              <Alert variant="warning" title="제출 마감">
                이 문제는 마감되었습니다. 더 이상 제출할 수 없습니다.
              </Alert>
            )}
          </div>

          {/* ─── 우측 사이드바 (모바일: 전체폭 / 데스크톱: 260px) ─── */}
          <div className="w-full lg:w-[260px] shrink-0 space-y-4">

            {/* 마감 정보 */}
            <div className="rounded-xl border border-border p-3 sm:p-5 space-y-3 bg-bg-card">
              <h3 className="text-[14px] font-bold text-text">마감 정보</h3>
              <div className="flex items-center justify-between">
                <span className="text-[13px]" style={{ color: 'var(--text-3)' }}>마감일</span>
                <span className="text-[13px] font-medium text-text">{deadlineFormatted}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px]" style={{ color: 'var(--text-3)' }}>주차</span>
                <span className="text-[13px] font-medium text-text">{problem.weekNumber}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px]" style={{ color: 'var(--text-3)' }}>플랫폼</span>
                <span className="text-[13px] font-medium text-text">{problem.sourcePlatform ?? '-'}</span>
              </div>
            </div>

            {/* 제출 현황 */}
            <div className="rounded-xl border border-border p-3 sm:p-5 bg-bg-card">
              <h3 className="text-[14px] font-bold text-text mb-3">제출 현황</h3>
              {submissions.length === 0 ? (
                <p className="text-[13px]" style={{ color: 'var(--text-3)' }}>
                  아직 제출 데이터가 없습니다.
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
                          </div>
                          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-3)' }}>{timeStr}</p>
                        </div>
                        {s.aiScore != null && (
                          <span className="text-[13px] font-bold" style={{ color: s.aiScore >= 80 ? 'var(--success)' : s.aiScore >= 60 ? 'var(--warning)' : 'var(--error)' }}>
                            {s.aiScore}점
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
