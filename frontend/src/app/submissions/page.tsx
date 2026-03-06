/**
 * @file 제출 목록 페이지 (v2 전면 교체)
 * @domain submission
 * @layer page
 * @related submissionApi, problemApi, LangBadge, StatusBadge, ScoreBadge
 */

'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FileText, ChevronLeft, ChevronRight, Filter, X, Search } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { EmptyState } from '@/components/ui/EmptyState';
import { LangBadge } from '@/components/ui/LangBadge';
import { DifficultyBadge } from '@/components/ui/DifficultyBadge';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import {
  submissionApi,
  problemApi,
  type Submission,
  type PaginatedResponse,
  type SubmissionListParams,
} from '@/lib/api';
import { useStudy } from '@/contexts/StudyContext';
import { SAGA_STEP_CONFIG, LANGUAGE_VALUES, type SagaStep, type Difficulty } from '@/lib/constants';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useRequireStudy } from '@/hooks/useRequireStudy';

// ─── CONSTANTS ────────────────────────────

const SAGA_STEP_KEYS = Object.keys(SAGA_STEP_CONFIG) as SagaStep[];
const PAGE_SIZE = 10;

// ─── HELPERS ──────────────────────────────

/**
 * ISO 날짜를 MM.DD HH:mm 포맷으로 변환
 * @domain submission
 */
function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${month}.${day} ${hours}:${minutes}`;
}

// ─── RENDER ───────────────────────────────

/**
 * 제출 목록 페이지
 * @domain submission
 */
export default function SubmissionsPage(): ReactNode {
  const router = useRouter();
  const { isReady, isAuthenticated } = useRequireAuth();
  useRequireStudy();
  const { currentStudyId, currentStudyName } = useStudy();

  // ─── STATE ──────────────────────────────

  const [data, setData] = useState<PaginatedResponse<Submission> | null>(null);
  const [problemDetailMap, setProblemDetailMap] = useState<Map<string, { title: string; difficulty?: string; weekNumber?: string }>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [filterLanguage, setFilterLanguage] = useState('');
  const [filterSagaStep, setFilterSagaStep] = useState('');
  const [filterWeek, setFilterWeek] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterSearch, setFilterSearch] = useState('');

  // ─── API ────────────────────────────────

  const loadSubmissions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: SubmissionListParams = { page, limit: PAGE_SIZE };
      if (filterLanguage) params.language = filterLanguage;
      if (filterSagaStep) params.sagaStep = filterSagaStep;
      if (filterWeek) params.weekNumber = filterWeek;
      const result = await submissionApi.list(params);
      setData(result);
    } catch (err: unknown) {
      setError((err as Error).message ?? '제출 이력을 불러오는 데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [page, filterLanguage, filterSagaStep, filterWeek]);

  useEffect(() => {
    if (isAuthenticated && currentStudyId) {
      void loadSubmissions();
    }
  }, [isAuthenticated, currentStudyId, loadSubmissions]);

  useEffect(() => {
    if (!isAuthenticated || !currentStudyId) return;
    void problemApi.findAllIncludingClosed().then((problems) => {
      setProblemDetailMap(new Map(problems.map((p) => [p.id, { title: p.title, difficulty: p.difficulty, weekNumber: p.weekNumber }])));
    }).catch(() => {});
  }, [isAuthenticated, currentStudyId]);

  // ─── HANDLERS ─────────────────────────────

  const handleFilterChange = useCallback(
    (setter: (v: string) => void) =>
      (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
        setter(e.target.value);
        setPage(1);
      },
    [],
  );

  const handleResetFilters = useCallback(() => {
    setFilterLanguage('');
    setFilterSagaStep('');
    setFilterWeek('');
    setFilterSearch('');
    setPage(1);
  }, []);

  const totalPages = data?.meta.totalPages ?? 1;
  const hasFilters = filterLanguage || filterSagaStep || filterWeek || filterSearch;

  // 평균 AI 점수 계산 (aiScore가 있는 제출만)
  const scoredSubmissions = data?.data.filter((s) => s.aiScore != null) ?? [];
  const avgAiScore =
    scoredSubmissions.length > 0
      ? Math.round(scoredSubmissions.reduce((sum, s) => sum + (s.aiScore ?? 0), 0) / scoredSubmissions.length)
      : null;

  if (!isReady) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-bg">
        <LoadingSpinner size="lg" color="primary" />
        <p className="text-sm text-text-3">로딩 중...</p>
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-text">
              {currentStudyName ? `${currentStudyName} · 제출 이력` : '제출 이력'}
            </h1>
            <p className="mt-0.5 font-mono text-[10px] text-text-3">
              {data ? `총 ${data.meta.total}건` : '불러오는 중...'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Stat Cards (md 이상에서만 표시) */}
            {data && (
              <div className="hidden md:flex items-center gap-3">
                <div className="flex items-center gap-2 rounded-card border border-border bg-bg-card px-3.5 py-2 shadow">
                  <FileText className="h-3.5 w-3.5 text-primary" aria-hidden />
                  <span className="font-mono text-lg font-bold text-primary">{data.meta.total}</span>
                  <span className="text-[11px] text-text-3">총 제출</span>
                </div>
                <div className="flex items-center gap-2 rounded-card border border-border bg-bg-card px-3.5 py-2 shadow">
                  <svg className="h-3.5 w-3.5 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 1v4m0 14v4M4.22 4.22l2.83 2.83m9.9 9.9l2.83 2.83M1 12h4m14 0h4M4.22 19.78l2.83-2.83m9.9-9.9l2.83-2.83" />
                  </svg>
                  <span className="font-mono text-lg font-bold text-success">{avgAiScore ?? '\u2014'}</span>
                  <span className="text-[11px] text-text-3">평균 점수</span>
                </div>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFilters((v) => !v)}
            >
              <Filter className="h-3.5 w-3.5" aria-hidden />
              필터
            </Button>
          </div>
        </div>

        {/* 필터 패널 */}
        {showFilters && (
          <Card className="p-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="relative flex-1 min-w-[160px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-3 pointer-events-none" aria-hidden />
                <input
                  type="text"
                  placeholder="문제 검색..."
                  value={filterSearch}
                  onChange={(e) => { setFilterSearch(e.target.value); setPage(1); }}
                  className="w-full h-[34px] pl-8 pr-3 rounded-btn border border-border bg-input-bg text-text text-xs outline-none placeholder:text-text-3 focus:border-primary"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="filter-language" className="block text-[10px] font-medium uppercase tracking-wider text-text-3">언어</label>
                <select
                  id="filter-language"
                  value={filterLanguage}
                  onChange={handleFilterChange(setFilterLanguage)}
                  className="h-[34px] px-2.5 pr-7 rounded-btn border border-border bg-input-bg text-text text-xs outline-none cursor-pointer focus:border-primary appearance-none bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239C9A95%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22M6%209l6%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_8px_center]"
                >
                  <option value="">전체</option>
                  {LANGUAGE_VALUES.map((lang) => (
                    <option key={lang} value={lang}>{lang}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label htmlFor="filter-saga" className="block text-[10px] font-medium uppercase tracking-wider text-text-3">상태</label>
                <select
                  id="filter-saga"
                  value={filterSagaStep}
                  onChange={handleFilterChange(setFilterSagaStep)}
                  className="h-[34px] px-2.5 pr-7 rounded-btn border border-border bg-input-bg text-text text-xs outline-none cursor-pointer focus:border-primary appearance-none bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239C9A95%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22M6%209l6%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_8px_center]"
                >
                  <option value="">전체</option>
                  {SAGA_STEP_KEYS.map((step) => (
                    <option key={step} value={step}>{SAGA_STEP_CONFIG[step].label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label htmlFor="filter-week" className="block text-[10px] font-medium uppercase tracking-wider text-text-3">주차</label>
                <input
                  id="filter-week"
                  type="text"
                  placeholder="예: 3월1주차"
                  value={filterWeek}
                  onChange={handleFilterChange(setFilterWeek)}
                  className="h-[34px] w-24 px-2.5 rounded-btn border border-border bg-input-bg text-text text-xs outline-none focus:border-primary"
                />
              </div>

              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={handleResetFilters}>
                  <X className="h-3 w-3" />
                  초기화
                </Button>
              )}
            </div>
          </Card>
        )}

        {/* 에러 */}
        {error && (
          <Alert variant="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* 로딩 */}
        {isLoading && (
          <Card className="p-4">
            <SkeletonTable rows={5} />
          </Card>
        )}

        {/* 빈 상태 */}
        {!isLoading && !error && data && data.data.length === 0 && (
          <EmptyState
            icon={FileText}
            title="제출 이력이 없습니다"
            description={
              hasFilters
                ? '필터 조건에 맞는 제출이 없습니다.'
                : '아직 제출한 코드가 없습니다. 문제를 풀어보세요!'
            }
            action={
              hasFilters
                ? { label: '필터 초기화', onClick: handleResetFilters }
                : { label: '문제 목록', onClick: () => router.push('/problems') }
            }
          />
        )}

        {/* 제출 목록 테이블 */}
        {!isLoading && data && data.data.length > 0 && (
          <>
            <Card className="p-0 overflow-hidden">
              {/* 헤더 행 (md 이상에서만 표시) */}
              <div
                className="hidden md:grid items-center gap-x-2 px-4 py-2.5 border-b border-border font-mono text-[10px] uppercase tracking-wider text-text-3"
                style={{ gridTemplateColumns: '64px 1fr 80px 72px 100px 80px 72px' }}
              >
                <span>주차</span>
                <span>문제</span>
                <span>난이도</span>
                <span>언어</span>
                <span>제출시간</span>
                <span>상태</span>
                <span>AI</span>
              </div>

              {/* 데이터 행 */}
              {data.data
                .filter((submission) => {
                  if (!filterSearch) return true;
                  const title = submission.problemTitle ?? problemDetailMap.get(submission.problemId)?.title ?? '';
                  return title.toLowerCase().includes(filterSearch.toLowerCase());
                })
                .map((submission) => {
                const sagaConfig = SAGA_STEP_CONFIG[submission.sagaStep] ?? {
                  label: submission.sagaStep,
                  variant: 'muted' as const,
                };
                const isDone = submission.sagaStep === 'DONE';

                return (
                  <div
                    key={submission.id}
                    className="w-full px-4 py-3 border-b border-border last:border-b-0 hover:bg-primary-soft transition-colors block md:grid md:items-center md:gap-x-2"
                    style={{ gridTemplateColumns: '64px 1fr 80px 72px 100px 80px 72px' }}
                  >
                    {/* 모바일 카드 뷰 */}
                    <div className="md:hidden space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[13px] font-medium text-text truncate flex-1 min-w-0">
                          {submission.problemTitle ?? problemDetailMap.get(submission.problemId)?.title ?? `문제 ${submission.problemId.slice(0, 8)}`}
                        </p>
                        <Badge variant={sagaConfig.variant} dot>
                          {sagaConfig.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[11px] text-text-3">
                          {problemDetailMap.get(submission.problemId)?.weekNumber ?? '-'}
                        </span>
                        <LangBadge language={submission.language} />
                        <span className="font-mono text-[10px] text-text-3">
                          {formatDate(submission.createdAt)}
                        </span>
                        {isDone && (
                          <Link
                            href={`/submissions/${submission.id}/analysis`}
                            className="text-[11px] font-medium text-primary hover:underline"
                          >
                            결과 보기
                          </Link>
                        )}
                      </div>
                    </div>

                    {/* 데스크탑 테이블 행 (md 이상) */}
                    <span className="hidden md:block font-mono text-[11px] text-text-3 truncate">
                      {problemDetailMap.get(submission.problemId)?.weekNumber ?? '-'}
                    </span>
                    <div className="hidden md:block min-w-0">
                      <p className="text-[13px] font-medium text-text truncate">
                        {submission.problemTitle ?? problemDetailMap.get(submission.problemId)?.title ?? `문제 ${submission.problemId.slice(0, 8)}`}
                      </p>
                    </div>
                    <span className="hidden md:block">
                      {(() => {
                        const diff = problemDetailMap.get(submission.problemId)?.difficulty;
                        return diff ? (
                          <DifficultyBadge difficulty={diff as Difficulty} />
                        ) : (
                          <span className="font-mono text-[10px] text-text-3">--</span>
                        );
                      })()}
                    </span>
                    <span className="hidden md:block">
                      <LangBadge language={submission.language} />
                    </span>
                    <span className="hidden md:block font-mono text-[10px] text-text-3 whitespace-nowrap">
                      {formatDate(submission.createdAt)}
                    </span>
                    <span className="hidden md:block">
                      <Badge variant={sagaConfig.variant} dot>
                        {sagaConfig.label}
                      </Badge>
                    </span>
                    <span className="hidden md:block">
                      {isDone ? (
                        <Link
                          href={`/submissions/${submission.id}/analysis`}
                          className="text-[11px] font-medium text-primary transition-colors hover:underline whitespace-nowrap"
                        >
                          결과 보기
                        </Link>
                      ) : (
                        <span className="font-mono text-[10px] text-text-3">-</span>
                      )}
                    </span>
                  </div>
                );
              })}
            </Card>

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page <= 1 || isLoading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                  .reduce<(number | 'ellipsis')[]>((acc, p, idx, arr) => {
                    if (idx > 0 && p - (arr[idx - 1] as number) > 1) {
                      acc.push('ellipsis');
                    }
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((item, i) =>
                    item === 'ellipsis' ? (
                      <span key={`e-${i}`} className="px-1 text-text-3 text-xs">...</span>
                    ) : (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setPage(item)}
                        className={`flex h-8 w-8 items-center justify-center rounded-btn text-xs font-medium transition-colors ${
                          item === page
                            ? 'bg-primary text-white'
                            : 'text-text-2 border border-border hover:bg-bg-alt'
                        }`}
                      >
                        {item}
                      </button>
                    ),
                  )}

                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page >= totalPages || isLoading}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
