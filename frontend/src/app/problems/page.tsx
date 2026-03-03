/**
 * @file 문제 목록 페이지 (v2 전면 교체)
 * @domain problem
 * @layer page
 * @related problemApi, studyApi, DifficultyBadge, TimerBadge, AppLayout
 */

'use client';

import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, Plus, Search, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DifficultyBadge } from '@/components/ui/DifficultyBadge';
import { TimerBadge } from '@/components/ui/TimerBadge';
import { Alert } from '@/components/ui/Alert';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { problemApi, studyApi, type Problem } from '@/lib/api';
import { useStudy } from '@/contexts/StudyContext';
import { DIFFICULTIES, DIFFICULTY_LABELS, PROBLEM_STATUSES, PROBLEM_STATUS_LABELS } from '@/lib/constants';
import type { Difficulty } from '@/lib/constants';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useRequireStudy } from '@/hooks/useRequireStudy';

// ─── TYPES ────────────────────────────────

interface Filters {
  search: string;
  difficulty: string;
  weekNumber: string;
  status: string;
}

// ─── CONSTANTS ────────────────────────────

const INITIAL_FILTERS: Filters = {
  search: '',
  difficulty: '',
  weekNumber: '',
  status: '',
};

// ─── RENDER ───────────────────────────────

/**
 * 문제 목록 페이지
 * @domain problem
 */
export default function ProblemsPage(): ReactNode {
  const router = useRouter();
  const { isAuthenticated } = useRequireAuth();
  useRequireStudy();
  const { currentStudyId, currentStudyRole, currentStudyName } = useStudy();
  const isAdmin = currentStudyRole === 'ADMIN';

  // ─── STATE ──────────────────────────────

  const [problems, setProblems] = useState<Problem[]>([]);
  const [solvedIds, setSolvedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  // ─── API ────────────────────────────────

  const loadProblems = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const [data, stats] = await Promise.all([
        problemApi.findAll(),
        currentStudyId ? studyApi.getStats(currentStudyId) : null,
      ]);
      setProblems(data);
      if (stats?.solvedProblemIds) {
        setSolvedIds(new Set(stats.solvedProblemIds));
      }
    } catch (err: unknown) {
      setError((err as Error).message ?? '문제 목록을 불러오는 데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [currentStudyId]);

  useEffect(() => {
    if (isAuthenticated) {
      void loadProblems();
    }
  }, [isAuthenticated, loadProblems]);

  // ─── HANDLERS ─────────────────────────────

  const handleProblemClick = useCallback(
    (id: string): void => {
      router.push(`/problems/${id}`);
    },
    [router],
  );

  const handleFilterChange = (key: keyof Filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const handleResetFilters = () => {
    setFilters(INITIAL_FILTERS);
    setPage(1);
  };

  // ─── HELPERS ──────────────────────────────

  const filteredProblems = useMemo(() => {
    return problems.filter((p) => {
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const matchTitle = p.title.toLowerCase().includes(q);
        const matchUrl = p.sourceUrl?.toLowerCase().includes(q) ?? false;
        const matchTags = p.tags?.some(t => t.toLowerCase().includes(q)) ?? false;
        if (!matchTitle && !matchUrl && !matchTags) return false;
      }
      if (filters.difficulty && p.difficulty !== filters.difficulty) {
        return false;
      }
      if (filters.weekNumber && p.weekNumber !== filters.weekNumber) {
        return false;
      }
      if (filters.status && p.status !== filters.status) {
        return false;
      }
      return true;
    });
  }, [problems, filters]);

  const weekNumbers = useMemo(() => {
    const weeks = [...new Set(problems.map((p) => p.weekNumber).filter(Boolean))];
    return weeks.sort();
  }, [problems]);

  const totalPages = Math.max(1, Math.ceil(filteredProblems.length / PAGE_SIZE));
  const paginatedProblems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredProblems.slice(start, start + PAGE_SIZE);
  }, [filteredProblems, page]);

  const hasActiveFilters = filters.search || filters.difficulty || filters.weekNumber || filters.status;

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-text">
              {currentStudyName ? `${currentStudyName} · 문제 목록` : '문제 목록'}
            </h1>
            {!isLoading && problems.length > 0 && (
              <p className="font-mono text-[10px] text-text-3 mt-0.5">
                {filteredProblems.length}개 문제
              </p>
            )}
          </div>
          {isAdmin && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => router.push('/problems/create')}
            >
              <Plus />
              문제 추가
            </Button>
          )}
        </div>

        {/* 필터 바 */}
        {!isLoading && problems.length > 0 && (
          <Card className="p-3">
            <div className="flex flex-wrap items-center gap-2">
              {/* 검색 */}
              <div className="relative flex-1 min-w-[160px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-3 pointer-events-none" />
                <input
                  type="text"
                  placeholder="문제명, BOJ 번호, 태그 검색..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className="w-full h-[34px] pl-8 pr-3 rounded-btn border border-border bg-input-bg text-text text-xs font-body outline-none transition-[border-color] duration-150 placeholder:text-text-3 focus:border-primary"
                />
              </div>

              {/* 난이도 */}
              <select
                value={filters.difficulty}
                onChange={(e) => handleFilterChange('difficulty', e.target.value)}
                className="h-[34px] px-2.5 pr-7 rounded-btn border border-border bg-input-bg text-text text-xs font-body outline-none cursor-pointer focus:border-primary appearance-none bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239C9A95%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22M6%209l6%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_8px_center]"
              >
                <option value="">전체</option>
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>
                ))}
              </select>

              {/* 주차 */}
              <select
                value={filters.weekNumber}
                onChange={(e) => handleFilterChange('weekNumber', e.target.value)}
                className="h-[34px] px-2.5 pr-7 rounded-btn border border-border bg-input-bg text-text text-xs font-body outline-none cursor-pointer focus:border-primary appearance-none bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239C9A95%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22M6%209l6%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_8px_center]"
              >
                <option value="">전체</option>
                {weekNumbers.map((w) => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>

              {/* 상태 */}
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="h-[34px] px-2.5 pr-7 rounded-btn border border-border bg-input-bg text-text text-xs font-body outline-none cursor-pointer focus:border-primary appearance-none bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239C9A95%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22M6%209l6%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_8px_center]"
              >
                <option value="">전체</option>
                {PROBLEM_STATUSES.map((s) => (
                  <option key={s} value={s}>{PROBLEM_STATUS_LABELS[s]}</option>
                ))}
              </select>

              {/* 초기화 */}
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={handleResetFilters}>
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

        {/* 로딩 스켈레톤 */}
        {isLoading && (
          <Card className="p-4">
            <SkeletonTable rows={5} />
          </Card>
        )}

        {/* 빈 상태 */}
        {!isLoading && !error && problems.length === 0 && (
          <EmptyState
            icon={BookOpen}
            title="등록된 문제가 없습니다"
            description="곧 새로운 문제가 추가될 예정입니다."
          />
        )}

        {/* 필터 결과 없음 */}
        {!isLoading && problems.length > 0 && filteredProblems.length === 0 && (
          <EmptyState
            icon={Search}
            title="검색 결과가 없습니다"
            description="필터 조건을 변경해 보세요."
            action={{ label: '필터 초기화', onClick: handleResetFilters }}
            size="sm"
          />
        )}

        {/* 문제 목록 테이블 */}
        {!isLoading && filteredProblems.length > 0 && (
          <>
            <Card className="p-0 overflow-hidden">
              {/* 헤더 행 */}
              <div
                className="grid items-center gap-x-2 px-4 py-2.5 border-b border-border font-mono text-[10px] uppercase tracking-wider text-text-3 min-w-[500px]"
                style={{ gridTemplateColumns: '64px 1fr 80px 100px 72px' }}
              >
                <span>주차</span>
                <span>문제</span>
                <span>난이도</span>
                <span>마감</span>
                <span>상태</span>
              </div>

              {/* 데이터 행 */}
              {paginatedProblems.map((problem) => {
                const deadlineDate = problem.deadline ? new Date(problem.deadline) : null;
                const isExpired = deadlineDate ? deadlineDate < new Date() : true;
                const isSolved = solvedIds.has(problem.id);

                return (
                  <button
                    key={problem.id}
                    type="button"
                    onClick={() => handleProblemClick(problem.id)}
                    aria-label={`${problem.title} 문제 보기`}
                    className="grid items-center gap-x-2 w-full px-4 py-3 text-left border-b border-border last:border-b-0 hover:bg-primary-soft transition-colors min-w-[500px]"
                    style={{ gridTemplateColumns: '64px 1fr 80px 100px 72px' }}
                  >
                    {/* 주차 */}
                    <span className="font-mono text-[11px] text-text-3 truncate">
                      {problem.weekNumber}
                    </span>

                    {/* 문제 제목 + 풀이 완료 체크 */}
                    <div className="min-w-0 flex items-center gap-2">
                      <p className="text-[13px] font-medium text-text truncate">
                        {problem.title}
                      </p>
                      {isSolved && (
                        <span className="flex items-center justify-center shrink-0 w-4 h-4 rounded-full bg-success-soft">
                          <Check className="w-2.5 h-2.5 text-success" />
                        </span>
                      )}
                    </div>

                    {/* 난이도 */}
                    {problem.difficulty ? (
                      <DifficultyBadge difficulty={problem.difficulty as Difficulty} level={problem.level} />
                    ) : (
                      <span className="font-mono text-[10px] text-text-3">--</span>
                    )}

                    {/* 마감 */}
                    <div>
                      {deadlineDate && !isExpired && problem.status === 'ACTIVE' ? (
                        <TimerBadge deadline={deadlineDate} />
                      ) : deadlineDate && isExpired ? (
                        <TimerBadge deadline={deadlineDate} />
                      ) : (
                        <span className="font-mono text-[10px] text-text-3">--</span>
                      )}
                    </div>

                    {/* 상태 */}
                    <Badge variant={problem.status === 'ACTIVE' ? 'success' : 'muted'}>
                      {problem.status === 'ACTIVE' ? '진행 중' : problem.status === 'DRAFT' ? '초안' : '종료'}
                    </Badge>
                  </button>
                );
              })}
            </Card>

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page <= 1}
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
                  disabled={page >= totalPages}
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
