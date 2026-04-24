/**
 * @file AI 분석 결과 페이지 (Figma v3 — 2-column layout, i18n 적용)
 * @domain ai
 * @layer page
 * @related submissionApi, ScoreGauge, CodeBlock, messages/submissions.json
 */

'use client';

import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { ArrowLeft, Loader2, Copy, Check, ExternalLink, Clock, Zap, Sparkles, ChevronDown, Brain, BarChart3 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { useRouter } from '@/i18n/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Skeleton } from '@/components/ui/Skeleton';
import { ScoreGauge } from '@/components/ui/ScoreGauge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { CodeBlock } from '@/components/ui/CodeBlock';
import { submissionApi, problemApi, type AnalysisResult, type Submission } from '@/lib/api';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useRequireStudy } from '@/hooks/useRequireStudy';
import { parseFeedback } from '@/lib/feedback';
import { relativeTime } from '@/lib/date';
import { useStudy } from '@/contexts/StudyContext';
import { DifficultyBadge } from '@/components/ui/DifficultyBadge';
import type { Difficulty } from '@/lib/constants';
import { AdBanner } from '@/components/ad/AdBanner';
import { AD_SLOTS } from '@/lib/constants/adSlots';
import { AiSatisfactionButton } from '@/components/submission/AiSatisfactionButton';

// ─── HELPERS ──────────────────────────────

function barColor(score: number): string {
  if (score >= 80) return 'var(--success)';
  if (score >= 60) return 'var(--warning)';
  return 'var(--error)';
}

/** category name → i18n 키 매핑 */
const CATEGORY_KEYS: Record<string, string> = {
  efficiency: 'analysis.categories.efficiency',
  readability: 'analysis.categories.readability',
  correctness: 'analysis.categories.correctness',
  structure: 'analysis.categories.structure',
  bestPractice: 'analysis.categories.bestPractice',
  style: 'analysis.categories.style',
  maintainability: 'analysis.categories.maintainability',
};

// ─── RENDER ───────────────────────────────

export default function AnalysisPage(): ReactNode {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations('submissions');
  const locale = useLocale();
  const { isReady, isAuthenticated } = useRequireAuth();
  useRequireStudy();
  const { currentStudyId } = useStudy();
  const submissionId = params.id as string;

  const [submission, setSubmission] = useState<Submission | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showOptimized, setShowOptimized] = useState(false);
  const [barsAnimated, setBarsAnimated] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCountRef = useRef(0);
  const pollStartRef = useRef<number | null>(null);
  const [pollTimedOut, setPollTimedOut] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const MAX_POLL_COUNT = 60; // 최대 60회 (10분)

  const [problemMeta, setProblemMeta] = useState<{ title?: string; difficulty?: string; level?: number; tags?: string[]; sourcePlatform?: 'BOJ' | 'PROGRAMMERS' | null } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isLoading && analysis?.analysisStatus === 'completed') {
      const timer = setTimeout(() => setBarsAnimated(true), 400);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isLoading, analysis?.analysisStatus]);

  const fade = (delay = 0): React.CSSProperties => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(16px)',
    transition: `opacity .5s cubic-bezier(.16,1,.3,1) ${delay}s, transform .5s cubic-bezier(.16,1,.3,1) ${delay}s`,
  });

  // ─── API ────────────────────────────────

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [sub, analysisResult] = await Promise.all([
        submissionApi.findById(submissionId),
        submissionApi.getAnalysis(submissionId),
      ]);
      setSubmission(sub);
      setAnalysis(analysisResult);

      // 문제 메타데이터 로드 (problemId가 있는 경우)
      if (sub.problemId) {
        try {
          const problem = await problemApi.findById(sub.problemId);
          setProblemMeta({
            title: problem.title,
            difficulty: problem.difficulty,
            level: problem.level ?? undefined,
            tags: problem.tags ?? undefined,
            sourcePlatform: problem.sourcePlatform ?? null,
          });
        } catch {
          // 문제 메타 로드 실패는 비차단 — 난이도 뱃지만 미표시
        }
      }
    } catch (err: unknown) {
      setError((err as Error).message ?? t('analysis.loadError'));
    } finally {
      setIsLoading(false);
    }
  }, [submissionId, t]);

  useEffect(() => {
    if (isAuthenticated && submissionId && currentStudyId) {
      void loadData();
    }
  }, [isAuthenticated, submissionId, currentStudyId, loadData]);

  // 폴링 (pending/delayed 상태) — 최대 60회(10분) 제한
  useEffect(() => {
    if (!analysis) return;
    if (analysis.analysisStatus !== 'pending' && analysis.analysisStatus !== 'delayed') return;
    if (pollTimedOut) return;

    // 폴링 시작 시점 기록
    if (!pollStartRef.current) pollStartRef.current = Date.now();

    // 경과 시간 업데이트 타이머
    const elapsedTimer = setInterval(() => {
      if (pollStartRef.current) {
        setElapsedSeconds(Math.floor((Date.now() - pollStartRef.current) / 1000));
      }
    }, 1000);

    pollTimerRef.current = setInterval(() => {
      pollCountRef.current += 1;
      if (pollCountRef.current >= MAX_POLL_COUNT) {
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        clearInterval(elapsedTimer);
        setPollTimedOut(true);
        return;
      }
      void loadData();
    }, 10_000);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      clearInterval(elapsedTimer);
    };
  }, [analysis, loadData, pollTimedOut]);

  useEffect(() => {
    const title = submission?.problemTitle ?? problemMeta?.title;
    if (title) {
      document.title = t('analysis.pageTitleWithProblem', { title });
    } else {
      document.title = t('analysis.pageTitle');
    }
    return () => { document.title = 'AlgoSu'; };
  }, [submission?.problemTitle, problemMeta?.title, t]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && isAuthenticated && submissionId) {
        void loadData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [isAuthenticated, submissionId, loadData]);

  // ─── HANDLERS ─────────────────────────────

  const handleCopy = async (text: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* 복사 실패 무시 */ }
  };

  const handleManualRefresh = useCallback(() => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollCountRef.current = 0;
    void loadData();
  }, [loadData]);

  // ─── LOADING ────────────────────────────

  if (!isReady) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-bg">
        <LoadingSpinner size="lg" color="primary" />
        <p className="text-sm text-text-3">{t('analysis.loading')}</p>
      </div>
    );
  }

  const parsed = analysis ? parseFeedback(analysis.feedback, analysis.score, analysis.optimizedCode) : null;

  // 코드 줄 수
  const codeStr = submission?.code ?? '';

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* ─── HEADER ─────────────────────────── */}
        <div className="space-y-3" style={fade(0)}>
          {/* 헤더: ← + 제목 */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push('/submissions')}
              className="flex items-center justify-center shrink-0 h-9 w-9 rounded-full transition-colors hover:bg-bg-alt"
            >
              <ArrowLeft className="h-5 w-5 text-[var(--text)]" />
            </button>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-text truncate">
              {submission?.problemTitle ?? problemMeta?.title ?? t('analysis.submissionFallback', { id: submissionId.slice(0, 8) })}
            </h1>
          </div>

          {/* 뱃지 행 */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* 난이도 뱃지 */}
            {problemMeta && (
              <DifficultyBadge
                difficulty={(problemMeta.difficulty as Difficulty | undefined) ?? null}
                level={problemMeta.level}
                sourcePlatform={problemMeta.sourcePlatform}
                className="px-2.5"
              />
            )}
            {/* 언어 뱃지 */}
            {submission && (
              <span
                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase bg-[var(--primary-soft)] text-[var(--primary)]"
              >
                {submission.language}
              </span>
            )}
            {/* 상태 뱃지 */}
            {analysis?.analysisStatus === 'completed' && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium bg-[var(--success-soft)] text-[var(--success)]"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" aria-hidden />
                {t('analysis.statusCompleted')}
              </span>
            )}
            {/* 점수 뱃지 */}
            {parsed && (
              <span
                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-[var(--success-soft)] text-[var(--success)]"
              >
                {t('analysis.scoreUnit', { score: parsed.totalScore })}
              </span>
            )}
            {/* 태그 뱃지 */}
            {problemMeta?.tags?.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium bg-[var(--bg-alt)] text-[var(--text-3)]"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* 시간 + 문제 보기 링크 */}
          <div className="flex flex-wrap items-center justify-between gap-1">
            <span className="text-[11px] sm:text-[12px] text-text-3">
              {submission ? `${relativeTime(submission.createdAt, locale)} · ${new Date(submission.createdAt).toLocaleDateString(locale, { month: 'long', day: 'numeric' })} ${new Date(submission.createdAt).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })}` : ''}
            </span>
            {submission && (
              <Link
                href={`/problems/${submission.problemId}`}
                className="inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline shrink-0"
              >
                {t('analysis.viewProblem')}
                <ExternalLink className="h-3 w-3" aria-hidden />
              </Link>
            )}
          </div>
        </div>

        {/* ─── ERROR ──────────────────────────── */}
        {error && (
          <Alert variant="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* ─── LOADING ───────────────────────── */}
        {isLoading && (
          <div className="space-y-4">
            <Skeleton height={80} />
            <div className="flex gap-4">
              <Skeleton height={300} className="flex-1" />
              <Skeleton height={300} className="w-[340px] shrink-0 hidden lg:block" />
            </div>
          </div>
        )}

        {/* ─── PENDING ───────────────────────── */}
        {!isLoading && analysis && analysis.analysisStatus === 'pending' && !pollTimedOut && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
              <LoadingSpinner size="lg" />
              <div className="text-center">
                <p className="text-sm font-medium text-text">{t('analysis.pending.title')}</p>
                <p className="mt-1 text-[11px] text-text-3">{t('analysis.pending.description')}</p>
                {elapsedSeconds > 0 && (
                  <p className="mt-1 text-[11px] text-text-3">
                    {t('analysis.pending.elapsed', { minutes: Math.floor(elapsedSeconds / 60), seconds: elapsedSeconds % 60 })}
                  </p>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={handleManualRefresh}>{t('analysis.refresh')}</Button>
            </CardContent>
          </Card>
        )}

        {/* ─── DELAYED ───────────────────────── */}
        {!isLoading && analysis && analysis.analysisStatus === 'delayed' && !pollTimedOut && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="flex items-center justify-center rounded-full bg-warning-soft p-4">
                <Loader2 className="h-8 w-8 text-warning" aria-hidden />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-text">{t('analysis.delayed.title')}</p>
                <p className="mt-1 text-[11px] text-text-3">{t('analysis.delayed.description')}</p>
                {elapsedSeconds > 0 && (
                  <p className="mt-1 text-[11px] text-text-3">
                    {t('analysis.pending.elapsed', { minutes: Math.floor(elapsedSeconds / 60), seconds: elapsedSeconds % 60 })}
                  </p>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={handleManualRefresh}>{t('analysis.refresh')}</Button>
            </CardContent>
          </Card>
        )}

        {/* ─── POLL TIMEOUT ───────────────────── */}
        {!isLoading && pollTimedOut && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="flex items-center justify-center rounded-full p-4 bg-[var(--warning-soft)]">
                <Clock className="h-8 w-8 text-[var(--warning)]" aria-hidden />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-text">{t('analysis.timeout.title')}</p>
                <p className="mt-1 text-[11px] text-text-3">{t('analysis.timeout.description')}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => {
                pollCountRef.current = 0;
                pollStartRef.current = Date.now();
                setElapsedSeconds(0);
                setPollTimedOut(false);
                void loadData();
              }}>{t('analysis.refresh')}</Button>
            </CardContent>
          </Card>
        )}

        {/* ─── FAILED ────────────────────────── */}
        {!isLoading && analysis && analysis.analysisStatus === 'failed' && (
          <Alert variant="error" title={t('analysis.failed.title')}>
            {t('analysis.failed.description')}
          </Alert>
        )}

        {/* ─── COMPLETED: 2-Column Layout ────── */}
        {!isLoading && analysis && analysis.analysisStatus === 'completed' && parsed && (
          <div className="flex flex-col lg:flex-row gap-4 items-stretch" style={fade(0.1)}>

            {/* ── LEFT: Code Viewer ──────────── */}
            <div className="w-full lg:w-1/2 min-w-0 flex flex-col">
              <Card className="p-0 overflow-hidden flex-1 flex flex-col">
                {/* 코드 헤더 */}
                <div
                  className="flex items-center justify-between px-5 h-12 shrink-0 border-b border-[var(--border)]"
                >
                  <span className="text-[13px] font-semibold text-text flex items-center gap-1.5">
                    <span className="text-[var(--primary)]">&lt;/&gt;</span>
                    {submission?.language ?? 'text'}
                  </span>
                  {codeStr && (
                    <button
                      onClick={() => void handleCopy(codeStr)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-badge text-[11px] font-medium transition-colors hover:bg-bg-alt text-[var(--text-3)]"
                    >
                      {copied ? <Check className="h-3 w-3 text-[var(--success)]" /> : <Copy className="h-3 w-3" />}
                      {copied ? t('analysis.copied') : t('analysis.copy')}
                    </button>
                  )}
                </div>

                {/* 코드 블록 */}
                <div className="overflow-auto">
                  {codeStr ? (
                    <CodeBlock
                      code={codeStr}
                      language={submission?.language ?? 'text'}
                    />
                  ) : (
                    <div className="p-4 text-xs text-text-3 bg-[var(--code-bg)]">
                      {t('analysis.codeUnavailable')}
                    </div>
                  )}
                </div>
              </Card>
            </div>

            {/* ── RIGHT: AI 분석 결과 사이드바 ── */}
            <div className="w-full lg:w-1/2 flex flex-col">
              <Card className="p-0 overflow-hidden flex-1 flex flex-col">
                {/* 카드 헤더 */}
                <div className="flex items-center justify-between px-5 h-12 shrink-0 border-b border-[var(--border)]">
                  <span className="flex items-center gap-2 text-[13px] font-semibold text-text">
                    <Brain className="h-4 w-4 text-[var(--primary)]" aria-hidden />
                    {t('analysis.heading')}
                  </span>
                </div>

                <div className="px-3 sm:px-5 py-4 sm:py-5 space-y-5">
                  {/* 원형 점수 게이지 */}
                  <div className="flex justify-center">
                    <ScoreGauge score={parsed.totalScore} size={160} label="/ 100" />
                  </div>

                  {/* 복잡도 뱃지 */}
                  {(parsed.timeComplexity || parsed.spaceComplexity) && (
                    <div className="flex items-center justify-center gap-3">
                      {parsed.timeComplexity && (
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium bg-[var(--info-soft)] text-[var(--info)]"
                        >
                          <Clock className="h-3.5 w-3.5" aria-hidden />
                          {t('analysis.timeComplexity', { value: parsed.timeComplexity })}
                        </span>
                      )}
                      {parsed.spaceComplexity && (
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium bg-[var(--primary-soft)] text-[var(--primary)]"
                        >
                          <Zap className="h-3.5 w-3.5" aria-hidden />
                          {t('analysis.spaceComplexity', { value: parsed.spaceComplexity })}
                        </span>
                      )}
                    </div>
                  )}

                  {/* AI 총평 텍스트 */}
                  {parsed.summary && (
                    <div
                      className="rounded-card px-4 py-3 text-[12px] leading-relaxed bg-[var(--primary-soft)] border-l-[3px] border-l-[var(--primary)] text-[var(--text-2)]"
                    >
                      {parsed.summary}
                    </div>
                  )}

                  {/* 항목별 평가 */}
                  {parsed.categories.length > 0 && (
                    <div className="space-y-1">
                      <p className="flex items-center gap-1.5 text-[13px] font-medium text-text pb-1 border-b border-b-[var(--border)]">
                        <BarChart3 className="h-3.5 w-3.5 text-[var(--primary)]" aria-hidden />
                        {t('analysis.categories.heading')}
                      </p>
                      {parsed.categories.map((cat) => {
                        const color = barColor(cat.score);
                        const label = CATEGORY_KEYS[cat.name] ? t(CATEGORY_KEYS[cat.name]) : cat.name;
                        return (
                          <div key={cat.name} className="py-2.5">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[13px] font-semibold text-text">{label}</span>
                              <span className="text-[13px] font-bold" style={{ color }}>{cat.score}</span>
                            </div>
                            <div className="h-1.5 rounded-full overflow-hidden bg-[var(--border)]">
                              <div
                                className="h-full rounded-full transition-all duration-700 ease-out"
                                style={{ width: barsAnimated ? `${cat.score}%` : '0%', backgroundColor: color }}
                              />
                            </div>
                            <p className="mt-1.5 text-[11px] leading-relaxed text-text-3">{cat.comment}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {/* AI 개선 코드 아코디언 */}
                  {parsed.optimizedCode && (
                    <div className="border-t border-t-[var(--border)]">
                      <button
                        type="button"
                        onClick={() => setShowOptimized(!showOptimized)}
                        className="flex items-center justify-between w-full px-0 py-2.5 text-[13px] font-medium text-text transition-colors hover:text-primary"
                      >
                        <span className="flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5 text-[var(--primary)]" aria-hidden />
                          {t('analysis.optimizedCode')}
                        </span>
                        <ChevronDown
                          className="h-4 w-4 text-text-3 transition-transform"
                          style={{ transform: showOptimized ? 'rotate(180deg)' : 'rotate(0deg)' }}
                          aria-hidden
                        />
                      </button>
                      {showOptimized && (
                        <div className="rounded-card overflow-hidden mb-1 border border-[var(--border)]">
                          <CodeBlock
                            code={parsed.optimizedCode}
                            language={submission?.language ?? 'text'}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              {/* AI 만족도 */}
              {submission && <AiSatisfactionButton submissionId={submission.id} />}
              </Card>
            </div>
          </div>
        )}
        {/* ── AD ── */}
        <AdBanner slot={AD_SLOTS.ANALYSIS_BOTTOM} />
      </div>
    </AppLayout>
  );
}
