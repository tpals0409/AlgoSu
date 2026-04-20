/**
 * @file 문제 목록 페이지 (Figma 디자인 반영)
 * @domain problem
 * @layer page
 * @related problemApi, studyApi, DifficultyBadge, AppLayout
 */

'use client';

import React, { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, Plus, Search, Check } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Alert } from '@/components/ui/Alert';
import { EmptyState } from '@/components/ui/EmptyState';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { problemApi, studyApi, type Problem } from '@/lib/api';
import { useStudy } from '@/contexts/StudyContext';
import { DIFFICULTIES, DIFFICULTY_LABELS, DIFF_DOT_STYLE, DIFF_BADGE_STYLE, toTierLevel, PROGRAMMERS_LEVEL_LABELS, PLATFORM_SHORT_LABELS } from '@/lib/constants';
import type { Difficulty } from '@/lib/constants';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useRequireStudy } from '@/hooks/useRequireStudy';
import { AddProblemModal, type NewProblemData } from '@/components/ui/AddProblemModal';
import { AdBanner } from '@/components/ad/AdBanner';
import { AD_SLOTS } from '@/lib/constants/adSlots';

// ─── TYPES ────────────────────────────────

interface Filters {
  search: string;
  difficulty: string;
  status: string;
}

// ─── CONSTANTS ────────────────────────────

const INITIAL_FILTERS: Filters = {
  search: '',
  difficulty: '',
  status: '',
};

const STATUS_TABS = [
  { value: '', label: '전체' },
  { value: 'ACTIVE', label: '진행 중' },
  { value: 'CLOSED', label: '종료' },
] as const;


// ─── HELPERS ─────────────────────────────

/** D-day 표시 (Figma: "D-N" 또는 "마감") */
function getDdayDisplay(deadline: string | null, status: string): { label: string; color: string } {
  if (status !== 'ACTIVE') return { label: '마감', color: 'var(--text-3)' };
  if (!deadline) return { label: '', color: '' };
  const remaining = new Date(deadline).getTime() - Date.now();
  if (remaining <= 0) return { label: '마감', color: 'var(--text-3)' };
  const days = Math.ceil(remaining / 86400000);
  return { label: `D-${days}`, color: 'var(--error)' };
}

// ─── RENDER ───────────────────────────────

/**
 * 문제 목록 페이지
 * @domain problem
 */
export default function ProblemsPage(): ReactNode {
  const router = useRouter();
  const { isAuthenticated } = useRequireAuth();
  useRequireStudy();
  const { currentStudyId, currentStudyRole } = useStudy();
  const isAdmin = currentStudyRole === 'ADMIN';

  // ─── STATE ──────────────────────────────

  const [problems, setProblems] = useState<Problem[]>([]);
  const [solvedIds, setSolvedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);
  const [showAddModal, setShowAddModal] = useState(false);
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
    if (isAuthenticated && currentStudyId) {
      void loadProblems();
    }
  }, [isAuthenticated, currentStudyId, loadProblems]);

  // ─── HANDLERS ─────────────────────────────

  const handleProblemClick = useCallback(
    (id: string): void => {
      router.push(`/problems/${id}`);
    },
    [router],
  );

  const handleFilterChange = (key: keyof Filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleAddProblem = useCallback((newProblem: NewProblemData) => {
    setProblems((prev) => [newProblem as unknown as Problem, ...prev]);
  }, []);

  // ─── FILTERING ──────────────────────────

  const filteredProblems = useMemo(() => {
    const filtered = problems.filter((p) => {
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
      if (filters.status && p.status !== filters.status) {
        return false;
      }
      return true;
    });
    return filtered.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
  }, [problems, filters]);

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* 헤더 */}
        <div style={fade(0)}>
          <h1 className="text-[22px] font-bold tracking-tight text-text">문제 목록</h1>
          <p className="text-[13px] mt-1" style={{ color: 'var(--text-3)' }}>
            스터디 문제를 확인하고 코드를 제출하세요.
          </p>
        </div>

        {/* 검색 + 상태 필터 */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3" style={fade(0.06)}>
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: 'var(--text-3)' }} aria-hidden />
            <input
              type="text"
              placeholder="문제 검색..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="w-full h-[44px] pl-10 pr-4 rounded-xl text-text text-sm font-body outline-none transition-[border-color] duration-150 placeholder:text-text-3 focus:border-primary"
              style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
            />
          </div>
          <Select value={filters.status} onValueChange={(v) => handleFilterChange('status', v === '__all__' ? '' : v)}>
            <SelectTrigger className="h-[44px] w-[130px] shrink-0 self-end sm:self-auto rounded-xl text-[13px] font-medium" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <SelectValue placeholder="상태 선택" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_TABS.map((tab) => (
                <SelectItem key={tab.value || '__all__'} value={tab.value || '__all__'}>{tab.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 난이도 필터 pills */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide" style={fade(0.1)}>
          <button
            type="button"
            onClick={() => handleFilterChange('difficulty', '')}
            className={`inline-flex items-center gap-1 shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-[12px] font-medium transition-all hover:shadow-sm hover:brightness-95 hover:scale-105${!filters.difficulty ? ' text-white' : ''}`}
            style={
              !filters.difficulty
                ? { backgroundColor: 'var(--primary)' }
                : { backgroundColor: 'var(--bg-card)', color: 'var(--text-2)', border: '1px solid var(--border)' }
            }
          >
            전체
          </button>
          {DIFFICULTIES.map((d) => {
            const diffKey = d.toLowerCase();
            const isActive = filters.difficulty === d;
            return (
              <button
                key={d}
                type="button"
                onClick={() => handleFilterChange('difficulty', isActive ? '' : d)}
                className={`inline-flex items-center gap-1 shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-[12px] font-medium transition-all hover:shadow-sm hover:brightness-95 hover:scale-105${isActive ? ' text-white' : ''}`}
                style={
                  isActive
                    ? { backgroundColor: 'var(--primary)' }
                    : DIFF_BADGE_STYLE[diffKey] ?? { backgroundColor: 'var(--bg-card)', color: 'var(--text-2)' }
                }
              >
                <span className={`h-1.5 w-1.5 rounded-full${isActive ? ' bg-white' : ''}`} style={isActive ? undefined : (DIFF_DOT_STYLE[diffKey] ?? {})} aria-hidden />
                {DIFFICULTY_LABELS[d]}
              </button>
            );
          })}
        </div>

        {/* 에러 */}
        {error && (
          <Alert variant="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* 로딩 스켈레톤 */}
        {isLoading && (
          <div className="rounded-xl border border-border overflow-hidden" style={{ backgroundColor: 'var(--bg-card)' }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-border last:border-b-0 animate-pulse">
                <div className="h-10 w-10 rounded-full" style={{ backgroundColor: 'var(--bg-alt)' }} />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/3 rounded" style={{ backgroundColor: 'var(--bg-alt)' }} />
                  <div className="h-3 w-1/4 rounded" style={{ backgroundColor: 'var(--bg-alt)' }} />
                </div>
              </div>
            ))}
          </div>
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
            action={{ label: '필터 초기화', onClick: () => setFilters(INITIAL_FILTERS) }}
            size="sm"
          />
        )}

        {/* 문제 목록 */}
        {!isLoading && filteredProblems.length > 0 && (
          <div className="space-y-2" style={fade(0.14)}>
            {filteredProblems.map((problem) => {
              const dday = getDdayDisplay(problem.deadline, problem.status);
              const isSolved = solvedIds.has(problem.id);

              return (
                <button
                  key={problem.id}
                  type="button"
                  onClick={() => handleProblemClick(problem.id)}
                  aria-label={`${problem.title} 문제 보기`}
                  className="group flex items-center gap-3 sm:gap-4 w-full px-3 sm:px-5 py-3 sm:py-4 rounded-xl border border-border transition-all text-left bg-bg-card hover:-translate-y-0.5 hover:shadow-hover"
                >
                  {/* 플랫폼 아이콘 */}
                  <div
                    className="flex items-center justify-center shrink-0 h-10 w-10 rounded-lg"
                    style={{ backgroundColor: 'var(--bg-alt)' }}
                  >
                    <span className="text-[10px] font-bold" style={{ color: 'var(--text-3)' }}>
                      {PLATFORM_SHORT_LABELS[problem.sourcePlatform ?? 'BOJ'] ?? problem.sourcePlatform ?? 'BOJ'}
                    </span>
                  </div>

                  {/* 문제 정보 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[14px] font-semibold text-text truncate transition-colors group-hover:text-primary">
                        {problem.title}
                      </p>
                      {isSolved && (
                        <span
                          className="flex items-center justify-center shrink-0 w-4 h-4 rounded-full"
                          style={{ backgroundColor: 'var(--success-soft)' }}
                        >
                          <Check className="w-2.5 h-2.5" style={{ color: 'var(--success)' }} />
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {(problem.difficulty || problem.sourcePlatform === 'PROGRAMMERS') && (() => {
                        const isProgrammers = problem.sourcePlatform === 'PROGRAMMERS';
                        if (isProgrammers) {
                          const lvLabel = problem.level != null ? (PROGRAMMERS_LEVEL_LABELS[problem.level] ?? 'Lv.0') : 'Lv.0';
                          const diffKey = problem.difficulty ? (problem.difficulty as string).toLowerCase() : '';
                          const dotStyle = diffKey ? (DIFF_DOT_STYLE[diffKey] ?? { backgroundColor: 'var(--text-3)' }) : { backgroundColor: 'var(--text-3)' };
                          const badgeStyle = diffKey ? (DIFF_BADGE_STYLE[diffKey] ?? { backgroundColor: 'var(--bg-alt)', color: 'var(--text-2)' }) : { backgroundColor: 'var(--bg-alt)', color: 'var(--text-2)' };
                          return (
                            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium" style={badgeStyle}>
                              <span className="h-1.5 w-1.5 rounded-full" style={dotStyle} aria-hidden />
                              {lvLabel}
                            </span>
                          );
                        }
                        const diffKey = (problem.difficulty as string).toLowerCase();
                        const dotStyle = DIFF_DOT_STYLE[diffKey] ?? { backgroundColor: 'var(--text-3)' };
                        const badgeStyle = DIFF_BADGE_STYLE[diffKey] ?? { backgroundColor: 'var(--bg-alt)', color: 'var(--text-2)' };
                        const displayLv = toTierLevel(problem.level);
                        const label = `${DIFFICULTY_LABELS[problem.difficulty as Difficulty] ?? problem.difficulty}${displayLv ? ` ${displayLv}` : ''}`;
                        return (
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium" style={badgeStyle}>
                            <span className="h-1.5 w-1.5 rounded-full" style={dotStyle} aria-hidden />
                            {label}
                          </span>
                        );
                      })()}
                      {(() => {
                        const isActive = problem.status === 'ACTIVE' && (!problem.deadline || new Date(problem.deadline) > new Date());
                        return (
                          <span
                            className="inline-flex items-center gap-1 rounded-badge px-2 py-0.5 text-[11px] font-medium"
                            style={
                              isActive
                                ? { backgroundColor: 'var(--success-soft)', color: 'var(--success)' }
                                : { backgroundColor: 'var(--bg-alt)', color: 'var(--text-3)' }
                            }
                          >
                            {isActive && (
                              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: 'var(--success)' }} aria-hidden />
                            )}
                            {isActive ? '진행 중' : '종료'}
                          </span>
                        );
                      })()}
                      <span className="text-[11px] font-medium" style={{ color: 'var(--text-3)' }}>
                        {problem.weekNumber}
                      </span>
                    </div>
                  </div>

                  {/* D-day */}
                  {dday.label && (
                    <span className="shrink-0 text-[13px] font-bold" style={{ color: dday.color }}>
                      {dday.label}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── AD ── */}
      <AdBanner slot={AD_SLOTS.PROBLEMS_LIST} />

      {/* 플로팅 문제 추가 버튼 + 모달 */}
      {isAdmin && (
        <>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="fixed bottom-20 md:bottom-6 right-6 inline-flex items-center gap-2 px-5 py-3 rounded-full text-white text-[14px] font-semibold shadow-lg transition-transform hover:scale-105 z-30"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            <Plus className="h-4 w-4" />
            문제 추가
          </button>
          <AddProblemModal
            open={showAddModal}
            onClose={() => setShowAddModal(false)}
            onAdd={handleAddProblem}
          />
        </>
      )}
    </AppLayout>
  );
}
