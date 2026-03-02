/**
 * @file 코드리뷰 2-패널 페이지 (v2 핵심 기능)
 * @domain review
 * @layer page
 * @related CodePanel, CommentThread, CommentForm, ScoreGauge, CategoryBar
 *
 * 좌측: 코드 뷰어 + AI 하이라이트 + 라인 댓글 인디케이터
 * 우측: AI 분석 요약 + 댓글 스레드 + 댓글 작성 폼
 * Focus Mode: 토글 버튼으로 헤더/사이드바 숨김
 * @guard cookie-auth httpOnly Cookie JWT 인증
 * @guard review-deadline 마감 전 타인 코드리뷰 열람 차단
 */

'use client';

import { useState, useEffect, useCallback, type ReactElement } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ChevronRight,
  Maximize2,
  Minimize2,
  AlertCircle,
  Code2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import {
  submissionApi,
  reviewApi,
  type Submission,
  type AnalysisResult,
  type ReviewComment,
} from '@/lib/api';
import { ScoreGauge } from '@/components/ui/ScoreGauge';
import { CategoryBar, type CategoryItem } from '@/components/ui/CategoryBar';
import { LangBadge } from '@/components/ui/LangBadge';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { CodePanel, type CodeHighlight } from '@/components/review/CodePanel';
import { CommentThread } from '@/components/review/CommentThread';
import { CommentForm } from '@/components/review/CommentForm';

// ─── TYPES ────────────────────────────────

interface FeedbackCategory {
  category: string;
  score: number;
  grade: string;
  color: 'success' | 'warning' | 'error';
  comment: string;
  lines: number[];
}

// ─── HELPERS ──────────────────────────────

/** feedback JSON 파싱 -> 카테고리 + 하이라이트 추출 */
function parseFeedback(feedbackStr: string | null): FeedbackCategory[] {
  if (!feedbackStr) return [];
  try {
    const parsed = JSON.parse(feedbackStr) as {
      categories?: FeedbackCategory[];
    };
    return parsed.categories ?? [];
  } catch {
    return [];
  }
}

/** 카테고리 -> CodeHighlight 변환 */
function categoriesToHighlights(
  categories: FeedbackCategory[],
  selectedIndex: number | null,
): CodeHighlight[] {
  if (selectedIndex === null) return [];
  const cat = categories[selectedIndex];
  if (!cat || !cat.lines?.length) return [];

  // 연속 라인을 그룹핑
  const sorted = [...cat.lines].sort((a, b) => a - b);
  const highlights: CodeHighlight[] = [];
  let start = sorted[0];
  let end = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i];
    } else {
      highlights.push({
        startLine: start,
        endLine: end,
        type: cat.color,
        message: cat.comment,
      });
      start = sorted[i];
      end = sorted[i];
    }
  }
  highlights.push({
    startLine: start,
    endLine: end,
    type: cat.color,
    message: cat.comment,
  });

  return highlights;
}

/** CategoryItem 변환 */
function toCategoryItem(cat: FeedbackCategory): CategoryItem {
  return {
    category: cat.category,
    score: cat.score,
    grade: cat.grade,
    color: cat.color,
    comment: cat.comment,
  };
}

// ─── COMPONENT ────────────────────────────

/**
 * 코드리뷰 2-패널 페이지
 * @domain review
 */
export default function CodeReviewPage(): ReactElement {
  const params = useParams<{ submissionId: string }>();
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  // ─── STATE ──────────────────────────────
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [focusMode, setFocusMode] = useState(false);

  const submissionId = params.submissionId;
  const currentUserId = user?.email ?? '';
  const categories = parseFeedback(analysis?.feedback ?? null);
  const highlights = categoriesToHighlights(categories, selectedCategory);
  const commentLines = [...new Set(comments.filter((c) => c.lineNumber).map((c) => c.lineNumber as number))];
  const totalScore = categories.length > 0
    ? Math.round(categories.reduce((a, c) => a + c.score, 0) / categories.length)
    : (analysis?.score ?? 0);

  // ─── DATA LOADING ───────────────────────

  const loadData = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const [sub, anal, cmts] = await Promise.all([
        submissionApi.findById(submissionId),
        submissionApi.getAnalysis(submissionId).catch(() => null),
        reviewApi.listComments(submissionId),
      ]);
      setSubmission(sub);
      setAnalysis(anal);
      setComments(cmts);
    } catch {
      setError('데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [submissionId]);

  useEffect(() => {
    if (!isAuthenticated || authLoading) return;
    void loadData();
  }, [isAuthenticated, authLoading, loadData]);

  // ─── HANDLERS ───────────────────────────

  const handleLineClick = (lineNum: number): void => {
    setSelectedLine(selectedLine === lineNum ? null : lineNum);
  };

  const handleCategoryClick = (idx: number): void => {
    setSelectedCategory(selectedCategory === idx ? null : idx);
  };

  const handleCreateComment = async (content: string): Promise<void> => {
    await reviewApi.createComment({
      submissionId,
      lineNumber: selectedLine,
      content,
    });
    const updated = await reviewApi.listComments(submissionId);
    setComments(updated);
  };

  const handleEditComment = (publicId: string, content: string): void => {
    void reviewApi.updateComment(publicId, content).then(async () => {
      const updated = await reviewApi.listComments(submissionId);
      setComments(updated);
    });
  };

  const handleDeleteComment = (publicId: string): void => {
    void reviewApi.deleteComment(publicId).then(async () => {
      const updated = await reviewApi.listComments(submissionId);
      setComments(updated);
    });
  };

  const handleReply = async (commentId: number, content: string): Promise<void> => {
    await reviewApi.createReply({ commentId, content });
    const updated = await reviewApi.listComments(submissionId);
    setComments(updated);
  };

  // ─── RENDER ─────────────────────────────

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen flex-col bg-bg">
        {!focusMode && <NavPlaceholder />}
        <div className="mx-auto grid w-full max-w-screen-xl flex-1 grid-cols-1 gap-4 px-4 py-6 lg:grid-cols-[1fr_380px]">
          <Skeleton height={500} />
          <div className="space-y-4">
            <Skeleton height={160} />
            <Skeleton height={300} />
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    router.push('/login');
    return <></>;
  }

  if (error || !submission) {
    return (
      <div className="flex min-h-screen flex-col bg-bg">
        <NavPlaceholder />
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <AlertCircle className="mx-auto mb-3 h-8 w-8 text-error opacity-60" />
            <p className="text-sm text-text-2">{error ?? '제출물을 찾을 수 없습니다.'}</p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-4"
              onClick={() => router.back()}
            >
              돌아가기
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // 코드는 analysis의 optimizedCode가 아닌 원본 코드 (향후 submission.code 사용)
  // 현재는 analysis.optimizedCode를 원본 코드의 fallback으로 사용
  const codeContent = analysis?.optimizedCode ?? '// 코드를 불러올 수 없습니다.';

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      {/* 헤더 (focus mode에서 숨김) */}
      {!focusMode && (
        <header className="glass-nav sticky top-0 z-50 border-b border-border">
          <div className="mx-auto flex h-14 max-w-screen-xl items-center justify-between px-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => router.back()}
                className="flex items-center gap-1 text-xs text-text-3 transition-colors hover:text-text"
                aria-label="뒤로가기"
              >
                <ChevronRight className="h-3.5 w-3.5 rotate-180" />
                돌아가기
              </button>
              <span className="text-[10px] text-text-3 opacity-30">|</span>
              <div className="flex items-center gap-2">
                <Code2 className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-text">
                  {submission.problemTitle ?? '코드 리뷰'}
                </span>
                <LangBadge language={submission.language} />
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFocusMode(true)}
              aria-label="Focus 모드"
            >
              <Maximize2 className="h-3.5 w-3.5" />
              Focus
            </Button>
          </div>
        </header>
      )}

      {/* Focus mode 해제 버튼 */}
      {focusMode && (
        <button
          type="button"
          onClick={() => setFocusMode(false)}
          className="fixed right-4 top-4 z-50 flex items-center gap-1 rounded-btn border border-border bg-bg-card px-3 py-1.5 text-xs text-text-2 shadow-card transition-colors hover:bg-bg-alt"
          aria-label="Focus 모드 해제"
        >
          <Minimize2 className="h-3 w-3" />
          ESC
        </button>
      )}

      {/* 메인: 2-패널 레이아웃 */}
      <div
        className={cn(
          'mx-auto grid w-full flex-1 gap-4 px-4 py-4',
          focusMode
            ? 'max-w-none grid-cols-1 lg:grid-cols-[1fr_380px]'
            : 'max-w-screen-xl grid-cols-1 lg:grid-cols-[1fr_380px]',
        )}
      >
        {/* 좌측: 코드 패널 */}
        <div className="min-w-0">
          <CodePanel
            code={codeContent}
            language={submission.language}
            highlights={highlights}
            commentLines={commentLines}
            onLineClick={handleLineClick}
            selectedLine={selectedLine}
          />
        </div>

        {/* 우측: 리뷰 패널 */}
        <div className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
          {/* AI 분석 요약 */}
          {analysis && analysis.analysisStatus === 'completed' && (
            <div className="mb-4 rounded-card border border-border bg-bg-card shadow-card">
              <div className="flex items-center gap-4 p-5">
                <ScoreGauge score={totalScore} size={90} />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-text">AI 분석 결과</p>
                  <p className="mt-0.5 text-[11px] text-text-3">
                    {categories.length}개 카테고리 평가
                  </p>
                </div>
              </div>

              {/* 카테고리 바 */}
              {categories.length > 0 && (
                <div className="border-t border-border">
                  {categories.map((cat, idx) => (
                    <CategoryBar
                      key={cat.category}
                      item={toCategoryItem(cat)}
                      selected={selectedCategory === idx}
                      onClick={() => handleCategoryClick(idx)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 댓글 섹션 */}
          <div className="rounded-card border border-border bg-bg-card p-4 shadow-card">
            <div className="mb-3 text-sm font-semibold text-text">
              {selectedLine ? `Line ${selectedLine} 댓글` : '댓글'}
              <span className="ml-1.5 text-[11px] font-normal text-text-3">
                ({comments.length})
              </span>
            </div>

            <CommentThread
              comments={comments}
              currentUserId={currentUserId}
              onEdit={handleEditComment}
              onDelete={handleDeleteComment}
              onReply={handleReply}
              selectedLine={selectedLine}
            />

            {/* 댓글 작성 폼 */}
            <div className="mt-3 border-t border-border pt-3">
              <CommentForm
                lineNumber={selectedLine}
                onSubmit={handleCreateComment}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ESC 키로 focus mode 해제 */}
      {focusMode && <EscHandler onEsc={() => setFocusMode(false)} />}
    </div>
  );
}

// ─── SUB-COMPONENTS ──────────────────────

/** 네비게이션 플레이스홀더 (로딩 상태) */
function NavPlaceholder(): ReactElement {
  return (
    <div className="glass-nav sticky top-0 z-50 border-b border-border">
      <div className="mx-auto flex h-14 max-w-screen-xl items-center px-4">
        <Skeleton width={200} height={20} />
      </div>
    </div>
  );
}

/** ESC 키 핸들러 */
function EscHandler({ onEsc }: { readonly onEsc: () => void }): null {
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onEsc();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onEsc]);

  return null;
}
