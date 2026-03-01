'use client';

import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, Plus, Search, X } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DifficultyBadge } from '@/components/ui/DifficultyBadge';
import { TimerBadge } from '@/components/ui/TimerBadge';
import { Alert } from '@/components/ui/Alert';
import { EmptyState } from '@/components/ui/EmptyState';
import { problemApi, type Problem } from '@/lib/api';
import { useStudy } from '@/contexts/StudyContext';

const DIFFICULTIES = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND'] as const;
const DIFFICULTY_LABELS: Record<string, string> = {
  BRONZE: '브론즈',
  SILVER: '실버',
  GOLD: '골드',
  PLATINUM: '플래티넘',
  DIAMOND: '다이아',
};

const STATUS_OPTIONS = ['ACTIVE', 'CLOSED', 'DRAFT'] as const;
const STATUS_LABELS: Record<string, string> = {
  ACTIVE: '진행 중',
  CLOSED: '종료',
  DRAFT: '초안',
};

interface Filters {
  search: string;
  difficulty: string;
  weekNumber: string;
  status: string;
}

const INITIAL_FILTERS: Filters = {
  search: '',
  difficulty: '',
  weekNumber: '',
  status: '',
};

export default function ProblemsPage(): ReactNode {
  const router = useRouter();
  const { currentStudyRole, currentStudyName } = useStudy();
  const isAdmin = currentStudyRole === 'OWNER';
  const [problems, setProblems] = useState<Problem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);

  const loadProblems = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await problemApi.findAll();
      setProblems(data);
    } catch (err: unknown) {
      setError((err as Error).message ?? '문제 목록을 불러오는 데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProblems();
  }, [loadProblems]);

  const handleProblemClick = useCallback(
    (id: string): void => {
      router.push(`/problems/${id}`);
    },
    [router],
  );

  // 클라이언트 사이드 필터링
  const filteredProblems = useMemo(() => {
    return problems.filter((p) => {
      if (filters.search && !p.title.toLowerCase().includes(filters.search.toLowerCase())) {
        return false;
      }
      if (filters.difficulty && p.difficulty !== filters.difficulty) {
        return false;
      }
      if (filters.weekNumber && p.weekNumber !== Number(filters.weekNumber)) {
        return false;
      }
      if (filters.status && p.status !== filters.status) {
        return false;
      }
      return true;
    });
  }, [problems, filters]);

  // 주차 목록 (데이터에서 추출)
  const weekNumbers = useMemo(() => {
    const weeks = [...new Set(problems.map((p) => p.weekNumber).filter(Boolean))];
    return weeks.sort((a, b) => a - b);
  }, [problems]);

  const hasActiveFilters = filters.search || filters.difficulty || filters.weekNumber || filters.status;

  const handleFilterChange = (key: keyof Filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleResetFilters = () => {
    setFilters(INITIAL_FILTERS);
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-foreground">
              {currentStudyName ? `${currentStudyName} \u00B7 문제 목록` : '문제 목록'}
            </h1>
            <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
              {problems.length > 0
                ? `${Math.ceil(problems.length / 5)}주차 · ${problems.length}개 문제`
                : '문제를 불러오는 중...'}
            </p>
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
            <div className="flex flex-wrap items-end gap-3">
              {/* 검색어 */}
              <div className="flex flex-col flex-1 min-w-[180px]">
                <label
                  htmlFor="filter-search"
                  className="text-[11px] font-medium text-text2 mb-[5px]"
                >
                  검색
                </label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text3" />
                  <input
                    id="filter-search"
                    type="text"
                    placeholder="문제 제목 검색..."
                    value={filters.search}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                    className="w-full pl-8 pr-3 py-2 rounded-btn border border-border bg-bg2 text-text1 text-xs outline-none transition-[border-color] duration-150 placeholder:text-text3 focus:border-primary-500"
                    style={{ padding: '8px 12px 8px 30px', fontSize: '12px' }}
                  />
                </div>
              </div>

              {/* 난이도 */}
              <div className="flex flex-col">
                <label
                  htmlFor="filter-difficulty"
                  className="text-[11px] font-medium text-text2 mb-[5px]"
                >
                  난이도
                </label>
                <select
                  id="filter-difficulty"
                  value={filters.difficulty}
                  onChange={(e) => handleFilterChange('difficulty', e.target.value)}
                  className="px-3 py-2 rounded-btn border border-border bg-bg2 text-text1 text-xs outline-none transition-[border-color] duration-150 focus:border-primary-500"
                  style={{ padding: '8px 12px', fontSize: '12px' }}
                >
                  <option value="">전체</option>
                  {DIFFICULTIES.map((d) => (
                    <option key={d} value={d}>
                      {DIFFICULTY_LABELS[d]}
                    </option>
                  ))}
                </select>
              </div>

              {/* 주차 */}
              <div className="flex flex-col">
                <label
                  htmlFor="filter-week"
                  className="text-[11px] font-medium text-text2 mb-[5px]"
                >
                  주차
                </label>
                <select
                  id="filter-week"
                  value={filters.weekNumber}
                  onChange={(e) => handleFilterChange('weekNumber', e.target.value)}
                  className="px-3 py-2 rounded-btn border border-border bg-bg2 text-text1 text-xs outline-none transition-[border-color] duration-150 focus:border-primary-500"
                  style={{ padding: '8px 12px', fontSize: '12px' }}
                >
                  <option value="">전체</option>
                  {weekNumbers.map((w) => (
                    <option key={w} value={w}>
                      {w}주차
                    </option>
                  ))}
                </select>
              </div>

              {/* 상태 */}
              <div className="flex flex-col">
                <label
                  htmlFor="filter-status"
                  className="text-[11px] font-medium text-text2 mb-[5px]"
                >
                  상태
                </label>
                <select
                  id="filter-status"
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className="px-3 py-2 rounded-btn border border-border bg-bg2 text-text1 text-xs outline-none transition-[border-color] duration-150 focus:border-primary-500"
                  style={{ padding: '8px 12px', fontSize: '12px' }}
                >
                  <option value="">전체</option>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>

              {/* 초기화 */}
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetFilters}
                  className="mb-0.5"
                >
                  <X />
                  초기화
                </Button>
              )}
            </div>

            {/* 필터 결과 요약 */}
            {hasActiveFilters && (
              <p className="mt-2 font-mono text-[10px] text-muted-foreground">
                {filteredProblems.length}개 결과
              </p>
            )}
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
                <div key={i} className="animate-pulse h-12 bg-muted rounded mx-4 my-2" />
              ))}
            </div>
          </Card>
        )}

        {/* 빈 상태 */}
        {!isLoading && !error && problems.length === 0 && (
          <EmptyState
            icon={BookOpen}
            title="등록된 문제가 없습니다"
            description="곧 새로운 문제가 추가될 예정입니다."
            action={{ label: '새로고침', onClick: loadProblems }}
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
          <Card className="p-0 overflow-x-auto">
            {/* 헤더 행 */}
            <div
              className="grid items-center gap-x-2.5 px-4 py-2 border-b border-border font-mono text-[10px] uppercase tracking-wider text-muted-foreground min-w-[480px]"
              style={{ gridTemplateColumns: '28px 1fr auto auto auto' }}
            >
              <span>#</span>
              <span>문제</span>
              <span>난이도</span>
              <span>마감</span>
              <span>상태</span>
            </div>

            {/* 데이터 행 */}
            {filteredProblems.map((problem) => {
              const deadlineDate = problem.deadline ? new Date(problem.deadline) : null;
              const isExpired = deadlineDate ? deadlineDate < new Date() : true;
              const weekNumber = problem.weekNumber;

              return (
                <button
                  key={problem.id}
                  type="button"
                  onClick={() => handleProblemClick(problem.id)}
                  aria-label={`${problem.title} 문제 보기`}
                  className="grid items-center gap-x-2.5 w-full px-4 py-2.5 text-left border-b border-border last:border-b-0 hover:bg-muted/40 transition-colors min-w-[480px]"
                  style={{ gridTemplateColumns: '28px 1fr auto auto auto' }}
                >
                  {/* # */}
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {String(weekNumber).padStart(2, '0')}
                  </span>

                  {/* 문제 제목 + 주차 */}
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium text-foreground truncate">
                      {problem.title}
                    </p>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      {weekNumber}주차
                    </p>
                  </div>

                  {/* 난이도 */}
                  <DifficultyBadge difficulty={problem.difficulty} />

                  {/* 마감 */}
                  <div>
                    {deadlineDate && !isExpired && problem.status === 'ACTIVE' ? (
                      <TimerBadge deadline={deadlineDate} />
                    ) : (
                      <span className="font-mono text-[10px] text-muted-foreground">--</span>
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
        )}
      </div>
    </AppLayout>
  );
}
