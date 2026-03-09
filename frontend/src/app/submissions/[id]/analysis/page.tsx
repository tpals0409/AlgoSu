/**
 * @file AI 분석 결과 페이지 (Figma v3 — 2-column layout)
 * @domain ai
 * @layer page
 * @related submissionApi, ScoreGauge, CodeBlock
 */

'use client';

import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, Copy, Check, ExternalLink, Clock, Zap, Sparkles, ChevronDown, Brain, BarChart3 } from 'lucide-react';
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
import { useStudy } from '@/contexts/StudyContext';
import { toTierLevel } from '@/lib/constants';

// ─── TYPES ────────────────────────────────

interface ParsedFeedback {
  totalScore: number;
  summary: string;
  categories: FeedbackCategory[];
  optimizedCode: string | null;
  timeComplexity: string | null;
  spaceComplexity: string | null;
  codeLines: number | null;
}

interface FeedbackCategory {
  name: string;
  score: number;
  comment: string;
  highlights: { startLine: number; endLine: number }[];
}

// ─── DIFFICULTY STYLES ───────────────────

const DIFF_DOT_STYLE: Record<string, React.CSSProperties> = {
  bronze: { backgroundColor: 'var(--diff-bronze-color)' },
  silver: { backgroundColor: 'var(--diff-silver-color)' },
  gold: { backgroundColor: 'var(--diff-gold-color)' },
  platinum: { backgroundColor: 'var(--diff-platinum-color)' },
  diamond: { backgroundColor: 'var(--diff-diamond-color)' },
  ruby: { backgroundColor: 'var(--diff-ruby-color)' },
};

const DIFF_BADGE_STYLE: Record<string, React.CSSProperties> = {
  bronze: { backgroundColor: 'var(--diff-bronze-bg)', color: 'var(--diff-bronze-color)' },
  silver: { backgroundColor: 'var(--diff-silver-bg)', color: 'var(--diff-silver-color)' },
  gold: { backgroundColor: 'var(--diff-gold-bg)', color: 'var(--diff-gold-color)' },
  platinum: { backgroundColor: 'var(--diff-platinum-bg)', color: 'var(--diff-platinum-color)' },
  diamond: { backgroundColor: 'var(--diff-diamond-bg)', color: 'var(--diff-diamond-color)' },
  ruby: { backgroundColor: 'var(--diff-ruby-bg)', color: 'var(--diff-ruby-color)' },
};

const DIFFICULTY_LABELS: Record<string, string> = {
  BRONZE: 'Bronze', SILVER: 'Silver', GOLD: 'Gold',
  PLATINUM: 'Platinum', DIAMOND: 'Diamond', RUBY: 'Ruby',
};

// ─── HELPERS ──────────────────────────────

function extractComplexity(categories: FeedbackCategory[]): { time: string | null; space: string | null } {
  const efficiency = categories.find((c) => c.name === 'efficiency');
  if (!efficiency) return { time: null, space: null };
  const bigOPattern = /O\([^)]+\)/g;
  const matches = efficiency.comment.match(bigOPattern);
  if (matches && matches.length >= 2) return { time: matches[0], space: matches[1] };
  if (matches && matches.length === 1) return { time: matches[0], space: null };
  return { time: null, space: null };
}

function countCodeLines(code: string | null): number | null {
  if (!code) return null;
  return code.split('\n').filter((l) => l.trim().length > 0).length;
}

function parseFeedback(feedback: string | null, score: number | null, optimizedCode: string | null): ParsedFeedback | null {
  if (!feedback) return null;
  try {
    // 마크다운 코드 블록 제거 (```json ... ```)
    let cleaned = feedback.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }
    const parsed = JSON.parse(cleaned);
    const categories: FeedbackCategory[] = (parsed.categories ?? []).map((c: Record<string, unknown>) => ({
      name: c.name as string ?? '',
      score: c.score as number ?? 0,
      comment: c.comment as string ?? '',
      highlights: (c.highlights as { startLine: number; endLine: number }[]) ?? [],
    }));
    const complexity = extractComplexity(categories);
    const resolvedOptimizedCode = parsed.optimizedCode ?? optimizedCode ?? null;
    return {
      totalScore: parsed.totalScore ?? score ?? 0,
      summary: parsed.summary ?? '',
      categories,
      optimizedCode: resolvedOptimizedCode,
      timeComplexity: parsed.timeComplexity ?? complexity.time,
      spaceComplexity: parsed.spaceComplexity ?? complexity.space,
      codeLines: parsed.codeLines ?? countCodeLines(resolvedOptimizedCode),
    };
  } catch {
    return {
      totalScore: score ?? 0,
      summary: feedback,
      categories: [],
      optimizedCode: optimizedCode ?? null,
      timeComplexity: null,
      spaceComplexity: null,
      codeLines: null,
    };
  }
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}일 전`;
  return `${Math.floor(days / 30)}개월 전`;
}

function barColor(score: number): string {
  if (score >= 80) return 'var(--success)';
  if (score >= 60) return 'var(--warning)';
  return 'var(--error)';
}

const CATEGORY_LABELS: Record<string, string> = {
  efficiency: '효율성',
  readability: '가독성',
  correctness: '정확성',
  style: '코드 스타일',
  maintainability: '유지보수성',
};

// ─── RENDER ───────────────────────────────

export default function AnalysisPage(): ReactNode {
  const params = useParams();
  const router = useRouter();
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

  const [problemMeta, setProblemMeta] = useState<{ title?: string; difficulty?: string; level?: number; tags?: string[] } | null>(null);
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
          });
        } catch {
          // 문제 메타 로드 실패는 비차단 — 난이도 뱃지만 미표시
        }
      }
    } catch (err: unknown) {
      setError((err as Error).message ?? 'AI 분석 결과를 불러오는 데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [submissionId]);

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
      document.title = `AI 코드 분석 | ${title}`;
    } else {
      document.title = 'AI 코드 분석';
    }
    return () => { document.title = 'AlgoSu'; };
  }, [submission?.problemTitle, problemMeta?.title]);

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
        <p className="text-sm text-text-3">로딩 중...</p>
      </div>
    );
  }

  const parsed = analysis ? parseFeedback(analysis.feedback, analysis.score, analysis.optimizedCode) : null;

  // 난이도 키
  const diffKey = (problemMeta?.difficulty ?? '').toLowerCase();
  const diffLabel = problemMeta?.difficulty
    ? `${DIFFICULTY_LABELS[problemMeta.difficulty] ?? problemMeta.difficulty}${toTierLevel(problemMeta.level) ? ` ${toTierLevel(problemMeta.level)}` : ''}`
    : '';

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
              <ArrowLeft className="h-5 w-5" style={{ color: 'var(--text)' }} />
            </button>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-text truncate">
              {submission?.problemTitle ?? problemMeta?.title ?? `제출 ${submissionId.slice(0, 8)}`}
            </h1>
          </div>

          {/* 뱃지 행 */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* 난이도 뱃지 */}
            {diffLabel && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                style={DIFF_BADGE_STYLE[diffKey] ?? {}}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={DIFF_DOT_STYLE[diffKey] ?? {}} aria-hidden />
                {diffLabel}
              </span>
            )}
            {/* 언어 뱃지 */}
            {submission && (
              <span
                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase"
                style={{ backgroundColor: 'var(--primary-soft)', color: 'var(--primary)' }}
              >
                {submission.language}
              </span>
            )}
            {/* 상태 뱃지 */}
            {analysis?.analysisStatus === 'completed' && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                style={{ backgroundColor: 'var(--success-soft)', color: 'var(--success)' }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: 'var(--success)' }} aria-hidden />
                분석 완료
              </span>
            )}
            {/* 점수 뱃지 */}
            {parsed && (
              <span
                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                style={{ backgroundColor: 'var(--success-soft)', color: 'var(--success)' }}
              >
                {parsed.totalScore}점
              </span>
            )}
            {/* 태그 뱃지 */}
            {problemMeta?.tags?.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                style={{ backgroundColor: 'var(--bg-alt)', color: 'var(--text-3)' }}
              >
                {tag}
              </span>
            ))}
          </div>

          {/* 시간 + 문제 보기 링크 */}
          <div className="flex flex-wrap items-center justify-between gap-1">
            <span className="text-[11px] sm:text-[12px] text-text-3">
              {submission ? `${relativeTime(submission.createdAt)} · ${new Date(submission.createdAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })} ${new Date(submission.createdAt).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit', hour12: true })}` : ''}
            </span>
            {submission && (
              <Link
                href={`/problems/${submission.problemId}`}
                className="inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline shrink-0"
              >
                문제 보기
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
                <p className="text-sm font-medium text-text">AI 분석 중...</p>
                <p className="mt-1 text-[11px] text-text-3">분석이 완료되면 자동으로 결과가 표시됩니다.</p>
                {elapsedSeconds > 0 && (
                  <p className="mt-1 text-[11px] text-text-3">
                    경과 시간: {Math.floor(elapsedSeconds / 60)}분 {elapsedSeconds % 60}초
                  </p>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={handleManualRefresh}>새로고침</Button>
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
                <p className="text-sm font-medium text-text">분석 지연 중</p>
                <p className="mt-1 text-[11px] text-text-3">AI 분석 서비스가 일시적으로 지연되고 있습니다.</p>
                {elapsedSeconds > 0 && (
                  <p className="mt-1 text-[11px] text-text-3">
                    경과 시간: {Math.floor(elapsedSeconds / 60)}분 {elapsedSeconds % 60}초
                  </p>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={handleManualRefresh}>새로고침</Button>
            </CardContent>
          </Card>
        )}

        {/* ─── POLL TIMEOUT ───────────────────── */}
        {!isLoading && pollTimedOut && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="flex items-center justify-center rounded-full p-4" style={{ backgroundColor: 'var(--warning-soft)' }}>
                <Clock className="h-8 w-8" style={{ color: 'var(--warning)' }} aria-hidden />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-text">분석이 예상보다 오래 걸리고 있습니다</p>
                <p className="mt-1 text-[11px] text-text-3">나중에 다시 확인해주세요.</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => {
                pollCountRef.current = 0;
                pollStartRef.current = Date.now();
                setElapsedSeconds(0);
                setPollTimedOut(false);
                void loadData();
              }}>새로고침</Button>
            </CardContent>
          </Card>
        )}

        {/* ─── FAILED ────────────────────────── */}
        {!isLoading && analysis && analysis.analysisStatus === 'failed' && (
          <Alert variant="error" title="분석 실패">
            AI 분석 중 오류가 발생했습니다. 코드를 다시 제출하거나 관리자에게 문의해주세요.
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
                  className="flex items-center justify-between px-5 h-12 shrink-0 border-b"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <span className="text-[13px] font-semibold text-text flex items-center gap-1.5">
                    <span style={{ color: 'var(--primary)' }}>&lt;/&gt;</span>
                    {submission?.language ?? 'text'}
                  </span>
                  {codeStr && (
                    <button
                      onClick={() => void handleCopy(codeStr)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-badge text-[11px] font-medium transition-colors hover:bg-bg-alt"
                      style={{ color: 'var(--text-3)' }}
                    >
                      {copied ? <Check className="h-3 w-3" style={{ color: 'var(--success)' }} /> : <Copy className="h-3 w-3" />}
                      {copied ? '복사됨' : '복사'}
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
                    <div className="p-4 text-xs text-text-3" style={{ backgroundColor: 'var(--code-bg)' }}>
                      제출한 코드를 불러올 수 없습니다.
                    </div>
                  )}
                </div>
              </Card>
            </div>

            {/* ── RIGHT: AI 분석 결과 사이드바 ── */}
            <div className="w-full lg:w-1/2 flex flex-col">
              <Card className="p-0 overflow-hidden flex-1 flex flex-col">
                {/* 카드 헤더 */}
                <div className="flex items-center justify-between px-5 h-12 shrink-0 border-b" style={{ borderColor: 'var(--border)' }}>
                  <span className="flex items-center gap-2 text-[13px] font-semibold text-text">
                    <Brain className="h-4 w-4" style={{ color: 'var(--primary)' }} aria-hidden />
                    AI 분석 결과
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
                          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium"
                          style={{ backgroundColor: 'var(--info-soft)', color: 'var(--info)' }}
                        >
                          <Clock className="h-3.5 w-3.5" aria-hidden />
                          시간 {parsed.timeComplexity}
                        </span>
                      )}
                      {parsed.spaceComplexity && (
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium"
                          style={{ backgroundColor: 'var(--primary-soft)', color: 'var(--primary)' }}
                        >
                          <Zap className="h-3.5 w-3.5" aria-hidden />
                          공간 {parsed.spaceComplexity}
                        </span>
                      )}
                    </div>
                  )}

                  {/* AI 총평 텍스트 */}
                  {parsed.summary && (
                    <div
                      className="rounded-card px-4 py-3 text-[12px] leading-relaxed"
                      style={{
                        backgroundColor: 'var(--primary-soft)',
                        borderLeft: '3px solid var(--primary)',
                        color: 'var(--text-2)',
                      }}
                    >
                      {parsed.summary}
                    </div>
                  )}

                  {/* 항목별 평가 */}
                  {parsed.categories.length > 0 && (
                    <div className="space-y-1">
                      <p className="flex items-center gap-1.5 text-[13px] font-medium text-text pb-1" style={{ borderBottom: '1px solid var(--border)' }}>
                        <BarChart3 className="h-3.5 w-3.5" style={{ color: 'var(--primary)' }} aria-hidden />
                        항목별 평가
                      </p>
                      {parsed.categories.map((cat) => {
                        const color = barColor(cat.score);
                        const label = CATEGORY_LABELS[cat.name] ?? cat.name;
                        return (
                          <div key={cat.name} className="py-2.5">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[13px] font-semibold text-text">{label}</span>
                              <span className="text-[13px] font-bold" style={{ color }}>{cat.score}</span>
                            </div>
                            <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border)' }}>
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
                    <div style={{ borderTop: '1px solid var(--border)' }}>
                      <button
                        type="button"
                        onClick={() => setShowOptimized(!showOptimized)}
                        className="flex items-center justify-between w-full px-0 py-2.5 text-[13px] font-medium text-text transition-colors hover:text-primary"
                      >
                        <span className="flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5" style={{ color: 'var(--primary)' }} aria-hidden />
                          AI 개선 코드
                        </span>
                        <ChevronDown
                          className="h-4 w-4 text-text-3 transition-transform"
                          style={{ transform: showOptimized ? 'rotate(180deg)' : 'rotate(0deg)' }}
                          aria-hidden
                        />
                      </button>
                      {showOptimized && (
                        <div className="rounded-card overflow-hidden mb-1" style={{ border: '1px solid var(--border)' }}>
                          <CodeBlock
                            code={parsed.optimizedCode}
                            language={submission?.language ?? 'text'}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
