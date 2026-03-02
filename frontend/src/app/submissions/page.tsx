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
import { FileText, ChevronLeft, ChevronRight, Filter, X } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { EmptyState } from '@/components/ui/EmptyState';
import { LangBadge } from '@/components/ui/LangBadge';
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
import { SAGA_STEP_CONFIG, LANGUAGE_VALUES, type SagaStep } from '@/lib/constants';
import { useRequireAuth } from '@/hooks/useRequireAuth';

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
  const { currentStudyName } = useStudy();

  // ─── STATE ──────────────────────────────

  const [data, setData] = useState<PaginatedResponse<Submission> | null>(null);
  const [problemMap, setProblemMap] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [filterLanguage, setFilterLanguage] = useState('');
  const [filterSagaStep, setFilterSagaStep] = useState('');
  const [filterWeek, setFilterWeek] = useState('');
  const [showFilters, setShowFilters] = useState(false);

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
    if (isAuthenticated) {
      void loadSubmissions();
    }
  }, [isAuthenticated, loadSubmissions]);

  useEffect(() => {
    if (!isAuthenticated) return;
    void problemApi.findAllIncludingClosed().then((problems) => {
      setProblemMap(new Map(problems.map((p) => [p.id, p.title])));
    }).catch(() => {});
  }, [isAuthenticated]);

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
    setPage(1);
  }, []);

  const totalPages = data?.meta.totalPages ?? 1;
  const hasFilters = filterLanguage || filterSagaStep || filterWeek;

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
            <h1 className="text-lg font-bold tracking-tight text-text">
              {currentStudyName ? `${currentStudyName} · 제출 이력` : '제출 이력'}
            </h1>
            <p className="mt-0.5 font-mono text-[10px] text-text-3">
              {data ? `총 ${data.meta.total}건` : '불러오는 중...'}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFilters((v) => !v)}
          >
            <Filter className="h-3.5 w-3.5" aria-hidden />
            필터
          </Button>
        </div>

        {/* 필터 패널 */}
        {showFilters && (
          <Card className="p-3">
            <div className="flex flex-wrap items-end gap-3">
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
              {/* 헤더 행 */}
              <div
                className="grid items-center gap-x-2 px-4 py-2.5 border-b border-border font-mono text-[10px] uppercase tracking-wider text-text-3 min-w-[520px]"
                style={{ gridTemplateColumns: '1fr 72px 80px 100px 72px' }}
              >
                <span>문제</span>
                <span>언어</span>
                <span>상태</span>
                <span>제출일</span>
                <span>AI</span>
              </div>

              {/* 데이터 행 */}
              {data.data.map((submission) => {
                const sagaConfig = SAGA_STEP_CONFIG[submission.sagaStep] ?? {
                  label: submission.sagaStep,
                  variant: 'muted' as const,
                };
                const isDone = submission.sagaStep === 'DONE';

                return (
                  <div
                    key={submission.id}
                    className="grid items-center gap-x-2 w-full px-4 py-3 border-b border-border last:border-b-0 hover:bg-primary-soft transition-colors min-w-[520px]"
                    style={{ gridTemplateColumns: '1fr 72px 80px 100px 72px' }}
                  >
                    {/* 문제명 */}
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-text truncate">
                        {submission.problemTitle ?? problemMap.get(submission.problemId) ?? `문제 ${submission.problemId.slice(0, 8)}`}
                      </p>
                    </div>

                    {/* 언어 */}
                    <LangBadge language={submission.language} />

                    {/* 상태 */}
                    <Badge variant={sagaConfig.variant} dot>
                      {sagaConfig.label}
                    </Badge>

                    {/* 제출일 */}
                    <span className="font-mono text-[10px] text-text-3 whitespace-nowrap">
                      {formatDate(submission.createdAt)}
                    </span>

                    {/* AI 분석 */}
                    {isDone ? (
                      <Link
                        href={`/submissions/${submission.id}/analysis`}
                        className="text-[11px] font-medium text-primary hover:underline whitespace-nowrap"
                      >
                        결과 보기
                      </Link>
                    ) : (
                      <span className="font-mono text-[10px] text-text-3">-</span>
                    )}
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
