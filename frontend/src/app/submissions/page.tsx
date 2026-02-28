'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FileText, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  submissionApi,
  type Submission,
  type PaginatedResponse,
  type SubmissionListParams,
} from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

const SAGA_STEP_CONFIG: Record<string, { label: string; variant: 'success' | 'warning' | 'error' | 'info' | 'muted' }> = {
  DB_SAVED:       { label: '저장됨',     variant: 'muted' },
  GITHUB_QUEUED:  { label: 'GitHub 대기', variant: 'info' },
  AI_QUEUED:      { label: 'AI 분석 대기', variant: 'warning' },
  DONE:           { label: '완료',       variant: 'success' },
  FAILED:         { label: '실패',       variant: 'error' },
};

const LANGUAGE_OPTIONS = ['', 'python', 'javascript', 'typescript', 'java', 'cpp', 'c'] as const;
const SAGA_STEP_OPTIONS = ['', 'DB_SAVED', 'GITHUB_QUEUED', 'AI_QUEUED', 'DONE', 'FAILED'] as const;

const PAGE_SIZE = 10;

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${month}.${day} ${hours}:${minutes}`;
}

export default function SubmissionsPage(): ReactNode {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [data, setData] = useState<PaginatedResponse<Submission> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 필터 상태
  const [page, setPage] = useState(1);
  const [filterLanguage, setFilterLanguage] = useState('');
  const [filterSagaStep, setFilterSagaStep] = useState('');
  const [filterWeek, setFilterWeek] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // 인증 확인
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  const loadSubmissions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: SubmissionListParams = {
        page,
        limit: PAGE_SIZE,
      };
      if (filterLanguage) params.language = filterLanguage;
      if (filterSagaStep) params.sagaStep = filterSagaStep;
      if (filterWeek) params.weekNumber = Number(filterWeek);

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

  // 필터 변경 시 페이지 초기화
  const handleFilterChange = useCallback(
    (setter: (v: string) => void) =>
      (e: React.ChangeEvent<HTMLSelectElement>) => {
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

  const totalPages = data?.totalPages ?? 1;

  if (authLoading) return null;
  if (!isAuthenticated) return null;

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-foreground">제출 이력</h1>
            <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
              {data ? `총 ${data.total}건` : '불러오는 중...'}
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
              {/* 언어 필터 */}
              <div className="space-y-1">
                <label
                  htmlFor="filter-language"
                  className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
                >
                  언어
                </label>
                <select
                  id="filter-language"
                  value={filterLanguage}
                  onChange={handleFilterChange(setFilterLanguage)}
                  className="rounded-btn border border-border bg-surface px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">전체</option>
                  {LANGUAGE_OPTIONS.filter(Boolean).map((lang) => (
                    <option key={lang} value={lang}>{lang}</option>
                  ))}
                </select>
              </div>

              {/* Saga 상태 필터 */}
              <div className="space-y-1">
                <label
                  htmlFor="filter-saga"
                  className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
                >
                  상태
                </label>
                <select
                  id="filter-saga"
                  value={filterSagaStep}
                  onChange={handleFilterChange(setFilterSagaStep)}
                  className="rounded-btn border border-border bg-surface px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">전체</option>
                  {SAGA_STEP_OPTIONS.filter(Boolean).map((step) => (
                    <option key={step} value={step}>
                      {SAGA_STEP_CONFIG[step]?.label ?? step}
                    </option>
                  ))}
                </select>
              </div>

              {/* 주차 필터 */}
              <div className="space-y-1">
                <label
                  htmlFor="filter-week"
                  className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
                >
                  주차
                </label>
                <select
                  id="filter-week"
                  value={filterWeek}
                  onChange={handleFilterChange(setFilterWeek)}
                  className="rounded-btn border border-border bg-surface px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">전체</option>
                  {Array.from({ length: 20 }, (_, i) => i + 1).map((w) => (
                    <option key={w} value={w}>{w}주차</option>
                  ))}
                </select>
              </div>

              <Button variant="ghost" size="sm" onClick={handleResetFilters}>
                초기화
              </Button>
            </div>
          </Card>
        )}

        {/* 에러 */}
        {error && (
          <Alert variant="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* 로딩 스켈레톤 */}
        {isLoading && (
          <Card>
            <div className="divide-y divide-border">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="animate-pulse h-14 bg-muted rounded mx-4 my-2" />
              ))}
            </div>
          </Card>
        )}

        {/* 빈 상태 */}
        {!isLoading && !error && data && data.items.length === 0 && (
          <EmptyState
            icon={FileText}
            title="제출 이력이 없습니다"
            description={
              filterLanguage || filterSagaStep || filterWeek
                ? '필터 조건에 맞는 제출이 없습니다. 필터를 변경해 보세요.'
                : '아직 제출한 코드가 없습니다. 문제를 풀어보세요!'
            }
            action={
              filterLanguage || filterSagaStep || filterWeek
                ? { label: '필터 초기화', onClick: handleResetFilters }
                : { label: '문제 목록', onClick: () => router.push('/problems') }
            }
          />
        )}

        {/* 제출 목록 테이블 */}
        {!isLoading && data && data.items.length > 0 && (
          <>
            <Card className="p-0">
              {/* 헤더 행 */}
              <div
                className="grid items-center gap-x-2.5 px-4 py-2 border-b border-border font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
                style={{ gridTemplateColumns: '1fr auto auto auto auto' }}
              >
                <span>문제</span>
                <span>언어</span>
                <span>상태</span>
                <span>제출일</span>
                <span>분석</span>
              </div>

              {/* 데이터 행 */}
              {data.items.map((submission) => {
                const sagaConfig = SAGA_STEP_CONFIG[submission.sagaStep] ?? {
                  label: submission.sagaStep,
                  variant: 'muted' as const,
                };

                return (
                  <div
                    key={submission.id}
                    className="grid items-center gap-x-2.5 w-full px-4 py-2.5 border-b border-border last:border-b-0 hover:bg-muted/40 transition-colors"
                    style={{ gridTemplateColumns: '1fr auto auto auto auto' }}
                  >
                    {/* 문제명 */}
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium text-foreground truncate">
                        {submission.problemTitle ?? `문제 ${submission.problemId.slice(0, 8)}`}
                      </p>
                    </div>

                    {/* 언어 */}
                    <Badge variant="info">{submission.language}</Badge>

                    {/* Saga 상태 */}
                    <Badge variant={sagaConfig.variant} dot>
                      {sagaConfig.label}
                    </Badge>

                    {/* 제출일 */}
                    <span className="font-mono text-[10px] text-muted-foreground whitespace-nowrap">
                      {formatDate(submission.createdAt)}
                    </span>

                    {/* AI 분석 링크 */}
                    {submission.sagaStep === 'DONE' ? (
                      <Link
                        href={`/submissions/${submission.id}/analysis`}
                        className="text-[11px] font-medium text-primary hover:underline whitespace-nowrap"
                      >
                        피드백 보기
                      </Link>
                    ) : (
                      <span className="font-mono text-[10px] text-muted-foreground">-</span>
                    )}
                  </div>
                );
              })}
            </Card>

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
                  이전
                </Button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => {
                      // 현재 페이지 기준 앞뒤 2개씩 + 첫/마지막 페이지
                      return p === 1 || p === totalPages || Math.abs(p - page) <= 2;
                    })
                    .reduce<(number | 'ellipsis')[]>((acc, p, idx, arr) => {
                      if (idx > 0 && p - (arr[idx - 1] as number) > 1) {
                        acc.push('ellipsis');
                      }
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((item, i) =>
                      item === 'ellipsis' ? (
                        <span key={`e-${i}`} className="px-1 text-muted-foreground text-xs">
                          ...
                        </span>
                      ) : (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setPage(item)}
                          className={`flex h-7 w-7 items-center justify-center rounded-btn text-[11px] font-medium transition-colors ${
                            item === page
                              ? 'bg-primary-500 text-white'
                              : 'text-text2 hover:bg-bg2'
                          }`}
                        >
                          {item}
                        </button>
                      ),
                    )}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  다음
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
