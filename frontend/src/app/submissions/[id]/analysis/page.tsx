/**
 * @file AI 분석 결과 페이지 (v2 전면 교체)
 * @domain ai
 * @layer page
 * @related submissionApi, ScoreGauge, CategoryBar, SubmissionStatus
 */

'use client';

import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, Copy, Check, ExternalLink, Clock, Box, Code2, Sparkles } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Skeleton } from '@/components/ui/Skeleton';
import { LangBadge } from '@/components/ui/LangBadge';
import { ScoreGauge } from '@/components/ui/ScoreGauge';
import { CategoryBar, type CategoryItem } from '@/components/ui/CategoryBar';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { submissionApi, type AnalysisResult, type Submission } from '@/lib/api';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useRequireStudy } from '@/hooks/useRequireStudy';
import { useStudy } from '@/contexts/StudyContext';
import { useAiQuota } from '@/hooks/useAiQuota';

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

// ─── HELPERS ──────────────────────────────

/**
 * 효율성 카테고리 코멘트에서 복잡도 추출
 * @domain ai
 */
function extractComplexity(categories: FeedbackCategory[]): { time: string | null; space: string | null } {
  const efficiency = categories.find((c) => c.name === 'efficiency');
  if (!efficiency) return { time: null, space: null };

  const comment = efficiency.comment;
  // O(n), O(n log n), O(n^2), O(1), O(n*m) 등 패턴 매칭
  const bigOPattern = /O\([^)]+\)/g;
  const matches = comment.match(bigOPattern);

  if (matches && matches.length >= 2) {
    return { time: matches[0], space: matches[1] };
  }
  if (matches && matches.length === 1) {
    // 시간 복잡도만 언급된 경우
    return { time: matches[0], space: null };
  }
  return { time: null, space: null };
}

/**
 * 코드 줄 수 계산
 * @domain ai
 */
function countCodeLines(code: string | null): number | null {
  if (!code) return null;
  const lines = code.split('\n').filter((l) => l.trim().length > 0);
  return lines.length;
}

/**
 * feedback JSON 파싱 (안전)
 * @domain ai
 */
function parseFeedback(feedback: string | null, score: number | null, optimizedCode: string | null): ParsedFeedback | null {
  if (!feedback) return null;

  try {
    const parsed = JSON.parse(feedback);
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
    // JSON 파싱 실패 시 텍스트 피드백으로 폴백
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

/**
 * 카테고리 score -> CategoryItem color 변환
 * @domain ai
 */
function getGrade(score: number): { grade: string; color: 'success' | 'warning' | 'error' } {
  if (score >= 80) return { grade: '우수', color: 'success' };
  if (score >= 60) return { grade: '보통', color: 'warning' };
  return { grade: '개선 필요', color: 'error' };
}

// ─── RENDER ───────────────────────────────

/**
 * AI 분석 결과 페이지
 * @domain ai
 */
export default function AnalysisPage(): ReactNode {
  const params = useParams();
  const router = useRouter();
  const { isReady, isAuthenticated } = useRequireAuth();
  useRequireStudy();
  const { currentStudyId } = useStudy();
  const { quota } = useAiQuota(isAuthenticated);
  const submissionId = params.id as string;
  const codeRef = useRef<HTMLDivElement>(null);

  // ─── STATE ──────────────────────────────

  const [submission, setSubmission] = useState<Submission | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [codeTab, setCodeTab] = useState<'original' | 'optimized'>('original');
  const [selectedCat, setSelectedCat] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // 폴링 (pending/delayed 상태)
  useEffect(() => {
    if (!analysis) return;
    if (analysis.analysisStatus !== 'pending' && analysis.analysisStatus !== 'delayed') return;

    pollTimerRef.current = setInterval(() => { void loadData(); }, 10_000);
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [analysis, loadData]);

  // 탭 복귀 시 재로드
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
    } catch {
      // 복사 실패 무시
    }
  };

  const handleManualRefresh = useCallback(() => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
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

  const categoryItems: CategoryItem[] = parsed?.categories.map((c) => {
    const { grade, color } = getGrade(c.score);
    return {
      category: c.name,
      score: c.score,
      grade,
      color,
      comment: c.comment,
    };
  }) ?? [];

  return (
    <AppLayout>
      <div className="max-w-[860px] mx-auto space-y-4">
        {/* 뒤로가기 + 헤더 */}
        <div className="flex items-center gap-3">
          <Link
            href="/submissions"
            className="flex items-center justify-center w-7 h-7 rounded-btn bg-bg-alt text-text-3 transition-colors hover:text-text"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-[22px] font-bold tracking-tight text-text">AI 코드 분석 결과</h1>
            <p className="mt-0.5 font-mono text-[10px] text-text-3">
              {submission?.problemTitle ?? `제출 ${submissionId.slice(0, 8)}`}
              {submission && ` · ${submission.language}`}
            </p>
          </div>
          {/* AI 분석 일일 할당량 뱃지 */}
          {quota && (
            <Badge
              variant={quota.remaining > 0 ? 'muted' : 'warning'}
              className="flex items-center gap-1.5 shrink-0"
            >
              <Sparkles className="h-3 w-3" aria-hidden />
              {`오늘 ${quota.used}/${quota.limit}회`}
            </Badge>
          )}
        </div>

        {/* 에러 */}
        {error && (
          <Alert variant="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* 로딩 */}
        {isLoading && (
          <div className="space-y-4">
            <Skeleton height={80} />
            <Skeleton height={200} />
            <Skeleton height={200} />
          </div>
        )}

        {/* 분석 대기 중 */}
        {!isLoading && analysis && analysis.analysisStatus === 'pending' && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
              <LoadingSpinner size="lg" />
              <div className="text-center">
                <p className="text-sm font-medium text-text">AI 분석 중...</p>
                <p className="mt-1 text-[11px] text-text-3">
                  분석이 완료되면 자동으로 결과가 표시됩니다.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={handleManualRefresh}>
                새로고침
              </Button>
            </CardContent>
          </Card>
        )}

        {/* 분석 지연 */}
        {!isLoading && analysis && analysis.analysisStatus === 'delayed' && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="flex items-center justify-center rounded-full bg-warning-soft p-4">
                <Loader2 className="h-8 w-8 text-warning" aria-hidden />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-text">분석 지연 중</p>
                <p className="mt-1 text-[11px] text-text-3">
                  AI 분석 서비스가 일시적으로 지연되고 있습니다.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={handleManualRefresh}>
                새로고침
              </Button>
            </CardContent>
          </Card>
        )}

        {/* 분석 실패 */}
        {!isLoading && analysis && analysis.analysisStatus === 'failed' && (
          <Alert variant="error" title="분석 실패">
            AI 분석 중 오류가 발생했습니다. 코드를 다시 제출하거나 관리자에게 문의해주세요.
          </Alert>
        )}

        {/* 분석 완료 */}
        {!isLoading && analysis && analysis.analysisStatus === 'completed' && parsed && (
          <>
            {/* 점수 오버뷰 */}
            <Card>
              <CardContent className="py-6">
                <div className="flex items-center gap-8 flex-wrap">
                  <ScoreGauge score={parsed.totalScore} size={130} />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap gap-2 mb-3">
                      {submission && <LangBadge language={submission.language} />}
                      <Badge variant="success" dot>분석 완료</Badge>
                    </div>
                    {submission && (
                      <p className="font-mono text-[10px] text-text-3 mb-4">
                        제출일: {new Date(submission.createdAt).toLocaleString('ko-KR')}
                      </p>
                    )}

                    {/* Quick Stats 그리드 */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="flex items-center gap-2.5 rounded-lg bg-bg-alt px-3 py-2.5">
                        <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary-soft text-primary shrink-0">
                          <Clock className="h-3.5 w-3.5" aria-hidden />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] text-text-3 leading-tight">시간 복잡도</p>
                          <p className="text-xs font-semibold font-mono text-text leading-tight mt-0.5">
                            {parsed.timeComplexity ?? '—'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5 rounded-lg bg-bg-alt px-3 py-2.5">
                        <div className="flex items-center justify-center w-7 h-7 rounded-md bg-info-soft text-info shrink-0">
                          <Box className="h-3.5 w-3.5" aria-hidden />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] text-text-3 leading-tight">공간 복잡도</p>
                          <p className="text-xs font-semibold font-mono text-text leading-tight mt-0.5">
                            {parsed.spaceComplexity ?? '—'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5 rounded-lg bg-bg-alt px-3 py-2.5">
                        <div className="flex items-center justify-center w-7 h-7 rounded-md bg-success-soft text-success shrink-0">
                          <Code2 className="h-3.5 w-3.5" aria-hidden />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] text-text-3 leading-tight">코드 라인</p>
                          <p className="text-xs font-semibold font-mono text-text leading-tight mt-0.5">
                            {parsed.codeLines !== null ? `${parsed.codeLines}줄` : '—'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 카테고리별 피드백 */}
            {categoryItems.length > 0 && (
              <Card className="p-0 overflow-hidden">
                {categoryItems.map((item, i) => (
                  <CategoryBar
                    key={item.category}
                    item={item}
                    selected={selectedCat === i}
                    onClick={() => {
                      setSelectedCat(selectedCat === i ? null : i);
                      setCodeTab('original');
                      setTimeout(() => codeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
                    }}
                  />
                ))}
              </Card>
            )}

            {/* AI 총평 */}
            {parsed.summary && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary-soft text-primary">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
                        <circle cx="12" cy="12" r="3" />
                        <path d="M12 1v4m0 14v4M4.22 4.22l2.83 2.83m9.9 9.9l2.83 2.83M1 12h4m14 0h4M4.22 19.78l2.83-2.83m9.9-9.9l2.83-2.83" />
                      </svg>
                    </div>
                    AI 총평
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs leading-relaxed text-text-2 whitespace-pre-wrap">
                    {parsed.summary}
                  </p>
                  {/* GitHub 커밋 링크 */}
                  {submission?.sagaStep === 'DONE' && (
                    <div className="flex items-center gap-2 mt-3">
                      <ExternalLink className="h-3.5 w-3.5 text-text-3" />
                      <span className="text-[11px] text-text-3">
                        GitHub에 자동 커밋되었습니다
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* 코드 비교 */}
            {(analysis.feedback || parsed.optimizedCode) && (
              <div ref={codeRef}>
                <Card className="p-0 overflow-hidden">
                  {/* 탭 */}
                  {parsed.optimizedCode && (
                    <div className="flex border-b border-border">
                      {[
                        { key: 'original' as const, label: '내 코드' },
                        { key: 'optimized' as const, label: '최적화 코드' },
                      ].map((tab) => (
                        <button
                          key={tab.key}
                          onClick={() => {
                            setCodeTab(tab.key);
                            if (tab.key === 'optimized') setSelectedCat(null);
                          }}
                          className={`flex-1 px-4 py-3 text-xs font-medium transition-colors ${
                            codeTab === tab.key
                              ? 'text-primary bg-primary-soft border-b-2 border-primary'
                              : 'text-text-3 border-b-2 border-transparent hover:text-text-2'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* 코드 뷰 (간단한 라인넘버 + 하이라이트) */}
                  <div className="bg-code-bg overflow-auto min-h-[180px]">
                    {(() => {
                      const codeStr = codeTab === 'optimized' && parsed.optimizedCode
                        ? parsed.optimizedCode
                        : (analysis.feedback ? '' : '');

                      // feedback이 있는데 코드가 없으면 텍스트 피드백 표시
                      if (!codeStr && codeTab === 'original') {
                        return (
                          <div className="p-4 text-xs text-text-3">
                            제출한 코드를 확인하려면 제출 상세 페이지를 방문하세요.
                          </div>
                        );
                      }

                      if (!codeStr) {
                        return (
                          <div className="p-4 text-xs text-text-3">
                            최적화 코드가 제공되지 않았습니다.
                          </div>
                        );
                      }

                      const lines = codeStr.split('\n');
                      const hlLines = new Set<number>();
                      if (selectedCat !== null && codeTab === 'original' && parsed.categories[selectedCat]) {
                        for (const hl of parsed.categories[selectedCat].highlights) {
                          for (let l = hl.startLine; l <= hl.endLine; l++) {
                            hlLines.add(l);
                          }
                        }
                      }

                      return lines.map((line, i) => {
                        const isHL = hlLines.has(i + 1);
                        const catColor = selectedCat !== null && parsed.categories[selectedCat]
                          ? getGrade(parsed.categories[selectedCat].score).color
                          : 'success';
                        return (
                          <div
                            key={i}
                            className={`flex ${
                              isHL
                                ? catColor === 'success' ? 'bg-success-soft border-l-[3px] border-l-success' : catColor === 'warning' ? 'bg-warning-soft border-l-[3px] border-l-warning' : 'bg-error-soft border-l-[3px] border-l-error'
                                : 'border-l-[3px] border-l-transparent'
                            } transition-colors`}
                          >
                            <span
                              className={`w-10 min-w-[40px] text-right pr-3 text-xs font-mono leading-[22px] select-none ${
                                isHL ? 'opacity-80 font-semibold text-text' : 'opacity-40 text-text-3'
                              }`}
                              style={{ paddingTop: i === 0 ? '14px' : 0, paddingBottom: i === lines.length - 1 ? '14px' : 0 }}
                            >
                              {i + 1}
                            </span>
                            <pre
                              className="m-0 font-mono text-xs leading-[22px]"
                              style={{
                                paddingTop: i === 0 ? '14px' : 0,
                                paddingBottom: i === lines.length - 1 ? '14px' : 0,
                                color: isHL ? 'var(--text)' : 'var(--text2)',
                                fontWeight: isHL ? 500 : 400,
                              }}
                            >
                              {line || ' '}
                            </pre>
                          </div>
                        );
                      });
                    })()}
                  </div>

                  {/* 코드 하단 바 */}
                  <div className="flex items-center justify-between px-4 py-2 border-t border-border">
                    <div className="flex items-center gap-2">
                      {codeTab === 'optimized' && parsed.optimizedCode && (
                        <Badge variant="default">AI 추천</Badge>
                      )}
                    </div>
                    {parsed.optimizedCode && codeTab === 'optimized' && (
                      <button
                        onClick={() => void handleCopy(parsed.optimizedCode!)}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-badge border border-border text-text-2 text-[11px] font-medium hover:bg-bg-alt transition-colors"
                      >
                        {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                        {copied ? '복사됨' : '복사'}
                      </button>
                    )}
                  </div>
                </Card>
              </div>
            )}

            {/* 액션 버튼 */}
            <div className="flex gap-3">
              {submission && (
                <Button
                  variant="ghost"
                  size="lg"
                  className="flex-1"
                  onClick={() => router.push(`/problems/${submission.problemId}`)}
                >
                  다시 제출
                </Button>
              )}
              <Button
                variant="primary"
                size="lg"
                className="flex-1"
                onClick={() => router.push('/problems')}
              >
                다른 문제 풀기
              </Button>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
