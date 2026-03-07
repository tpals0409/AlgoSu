/**
 * @file 통계 페이지 (차트+통계 + dynamic import 최적화)
 * @domain analytics
 * @layer page
 * @related AppLayout, StudyContext, AnalyticsCharts
 */

'use client';

import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  ArrowLeft,
  RefreshCw,
  BarChart3,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { Skeleton } from '@/components/ui/Skeleton';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Button } from '@/components/ui/Button';
import { useStudy } from '@/contexts/StudyContext';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useRequireStudy } from '@/hooks/useRequireStudy';
import {
  studyApi,
  problemApi,
  type StudyStats,
  type Problem,
} from '@/lib/api';
import { cn, getCurrentWeekLabel } from '@/lib/utils';
import { getCurrentUserId } from '@/lib/auth';

// ─── DYNAMIC IMPORT (차트 영역 lazy load) ──

const AnalyticsCharts = dynamic(
  () => import('@/components/analytics/AnalyticsCharts'),
  {
    loading: () => (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height={68} />
          ))}
        </div>
        <div className="rounded-card border border-border bg-bg-card p-6 shadow-card">
          <Skeleton width="40%" height={20} className="mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <Skeleton width={64} height={14} />
                <Skeleton className="flex-1" height={20} />
                <Skeleton width={40} height={14} />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-card border border-border bg-bg-card p-6 shadow-card">
          <Skeleton width="40%" height={20} className="mb-4" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} width={80} height={32} className="rounded-md" />
            ))}
          </div>
        </div>
      </div>
    ),
  },
);

// ── 주차 키 파싱 (정렬용): "2월3주차" → 203 ──

function parseWeekKey(w: string): number {
  const m = w.match(/^(\d+)월(\d+)주차$/);
  return m ? Number(m[1]) * 100 + Number(m[2]) : 0;
}

// ── 메인 페이지 ──

export default function AnalyticsPage(): ReactNode {
  const router = useRouter();
  const { isReady, isAuthenticated } = useRequireAuth();
  useRequireStudy();
  const { currentStudyId, currentStudyName, studiesLoaded } = useStudy();

  const [stats, setStats] = useState<StudyStats | null>(null);
  const [allProblems, setAllProblems] = useState<Problem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!currentStudyId) return;
    setIsLoading(true);
    setError(null);
    try {
      const results = await Promise.allSettled([
        studyApi.getStats(currentStudyId),
        problemApi.findAllIncludingClosed(),
      ]);

      if (results[0].status === 'fulfilled') {
        setStats(results[0].value as StudyStats);
      } else {
        setError('통계 데이터를 불러오는 데 실패했습니다.');
      }

      if (results[1].status === 'fulfilled') {
        setAllProblems((results[1].value as Problem[]) ?? []);
      }
    } catch {
      setError('데이터를 불러오는 데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [currentStudyId]);

  useEffect(() => {
    if (!isAuthenticated || !studiesLoaded) return;
    if (currentStudyId) {
      void loadData();
    } else {
      setIsLoading(false);
    }
  }, [isAuthenticated, studiesLoaded, currentStudyId, loadData]);

  // 현재 사용자 ID
  const myId = useMemo(() => getCurrentUserId(), []);

  // 내 개인 통계
  const myStats = useMemo(() => {
    if (!stats?.byMember.length || !myId) return { count: 0, doneCount: 0 };
    const me = stats.byMember.find((m) => m.userId === myId);
    return me ? { count: me.count, doneCount: me.doneCount } : { count: 0, doneCount: 0 };
  }, [stats, myId]);

  // 내 완료율: 고유 문제 제출 수 / 전체 문제 수 (문제 풀이 기준)
  const myUniqueProblemCount = useMemo(() => {
    if (!stats?.byWeekPerUser.length || !myId) return 0;
    return stats.byWeekPerUser
      .filter((r) => r.userId === myId)
      .reduce((sum, r) => sum + r.count, 0);
  }, [stats, myId]);

  const myCompletionPct = allProblems.length > 0
    ? Math.round((myUniqueProblemCount / allProblems.length) * 100)
    : 0;

  // 참여 주차 수
  const myWeekCount = useMemo(() => {
    if (!stats?.byWeekPerUser.length || !myId) return 0;
    return stats.byWeekPerUser.filter((r) => r.userId === myId).length;
  }, [stats, myId]);

  // 주차별 문제 수 맵 (CLOSED 포함)
  const problemCountByWeek = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of allProblems) {
      map.set(p.weekNumber, (map.get(p.weekNumber) ?? 0) + 1);
    }
    return map;
  }, [allProblems]);

  const currentWeekLabel = useMemo(() => getCurrentWeekLabel(), []);

  // Section C: 내가 푼 알고리즘 유형 분포
  const myProblemIds = useMemo(
    () => new Set(stats?.solvedProblemIds ?? []),
    [stats],
  );

  const tagDistribution = useMemo(() => {
    const countMap = new Map<string, number>();

    for (const p of allProblems) {
      if (!myProblemIds.has(p.id)) continue;
      const tags = p.tags?.length ? p.tags : ['미분류'];
      for (const tag of tags) {
        countMap.set(tag, (countMap.get(tag) ?? 0) + 1);
      }
    }

    const sorted = Array.from(countMap.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
    const max = sorted[0]?.count ?? 0;
    return sorted.map((row) => ({ ...row, max }));
  }, [allProblems, myProblemIds]);

  // Section B: 나의 주차별 풀이 (전체 주차, 빈 주차 포함)
  const myWeeklyData = useMemo(() => {
    if (!myId) return [];

    // 유저별 주차 데이터 맵
    const myWeekMap = new Map<string, number>();
    for (const r of stats?.byWeekPerUser ?? []) {
      if (r.userId === myId) {
        myWeekMap.set(r.week, r.count);
      }
    }

    // allProblems에 존재하는 모든 주차 수집
    const allWeeks = new Set<string>();
    for (const p of allProblems) {
      allWeeks.add(p.weekNumber);
    }
    // 유저 데이터에 있는 주차도 포함
    for (const w of myWeekMap.keys()) {
      allWeeks.add(w);
    }

    // 주차별 데이터 조합 (내림차순)
    return Array.from(allWeeks)
      .map((week) => ({ week, count: myWeekMap.get(week) ?? 0 }))
      .sort((a, b) => parseWeekKey(b.week) - parseWeekKey(a.week));
  }, [stats, myId, allProblems]);

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
      <div className="space-y-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="flex w-7 h-7 items-center justify-center rounded-btn bg-bg-alt text-text-3 hover:text-text transition-colors"
              aria-label="대시보드로 돌아가기"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            </Link>
            <div>
              <h1 className="text-[22px] font-bold tracking-tight text-text">
                {currentStudyName ? `${currentStudyName} · 통계` : '통계'}
              </h1>
              <p className="mt-0.5 font-mono text-[10px] text-text-3">
                나의 풀이 현황
              </p>
            </div>
          </div>
          {currentStudyId && (
            <button
              type="button"
              className="flex w-7 h-7 items-center justify-center rounded-btn bg-bg-alt text-text-3 hover:text-text disabled:opacity-50 transition-colors"
              onClick={() => void loadData()}
              disabled={isLoading}
              aria-label="새로고침"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} aria-hidden />
            </button>
          )}
        </div>

        {error && (
          <Alert variant="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* 스터디 미선택 */}
        {!currentStudyId && !isLoading && (
          <Card className="p-8">
            <div className="flex flex-col items-center text-center gap-4">
              <div
                className="flex w-12 h-12 items-center justify-center rounded-full bg-bg-alt"
              >
                <BarChart3 className="h-5 w-5 text-primary" aria-hidden />
              </div>
              <div>
                <p className="text-sm font-medium text-text">스터디를 선택해주세요</p>
                <p className="mt-1 text-[11px] text-text-3">
                  통계를 보려면 먼저 스터디를 선택해야 합니다.
                </p>
              </div>
              <Button variant="primary" size="sm" onClick={() => router.push('/studies')}>
                스터디 목록
              </Button>
            </div>
          </Card>
        )}

        {/* 로딩 */}
        {isLoading && currentStudyId && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} height={68} />
              ))}
            </div>
            <Skeleton height={300} />
          </div>
        )}

        {/* 데이터 없음 */}
        {!isLoading && currentStudyId && stats && stats.totalSubmissions === 0 && (
          <Card className="p-8">
            <div className="flex flex-col items-center text-center gap-4">
              <div
                className="flex w-12 h-12 items-center justify-center rounded-full bg-bg-alt"
              >
                <BarChart3 className="h-5 w-5 text-primary" aria-hidden />
              </div>
              <div>
                <p className="text-sm font-medium text-text">아직 제출 데이터가 없습니다</p>
                <p className="mt-1 text-[11px] text-text-3">
                  문제를 풀고 코드를 제출하면 통계를 확인할 수 있습니다.
                </p>
              </div>
              <Button variant="primary" size="sm" onClick={() => router.push('/problems')}>
                문제 목록 보기
              </Button>
            </div>
          </Card>
        )}

        {/* 차트 영역 (dynamic) */}
        {!isLoading && currentStudyId && stats && stats.totalSubmissions > 0 && (
          <AnalyticsCharts
            myStatsCount={myStats.count}
            myStatsDoneCount={myStats.doneCount}
            myCompletionPct={myCompletionPct}
            myWeekCount={myWeekCount}
            myWeeklyData={myWeeklyData}
            problemCountByWeek={problemCountByWeek}
            currentWeekLabel={currentWeekLabel}
            tagDistribution={tagDistribution}
          />
        )}
      </div>
    </AppLayout>
  );
}
