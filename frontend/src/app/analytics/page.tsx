/**
 * @file 통계 페이지 (Figma v3 — 내 통계)
 * @domain analytics
 * @layer page
 * @related AppLayout, StudyContext, AnalyticsCharts
 */

'use client';

import { useState, useEffect, useCallback, useMemo, type ReactNode, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { BarChart3 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { Skeleton } from '@/components/ui/Skeleton';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Button } from '@/components/ui/Button';
import { useStudy } from '@/contexts/StudyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useRequireStudy } from '@/hooks/useRequireStudy';
import {
  studyApi,
  problemApi,
  type StudyStats,
  type Problem,
} from '@/lib/api';
import { getCurrentUserId } from '@/lib/auth';

// ─── DYNAMIC IMPORT ──────────────────────

const AnalyticsCharts = dynamic(
  () => import('@/components/analytics/AnalyticsCharts'),
  {
    loading: () => (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height={80} />
          ))}
        </div>
        <Skeleton height={260} />
        <Skeleton height={300} />
      </div>
    ),
  },
);

// ─── HELPERS ─────────────────────────────

function parseWeekKey(w: string): number {
  const m = w.match(/^(\d+)월(\d+)주차$/);
  return m ? Number(m[1]) * 100 + Number(m[2]) : 0;
}

// ─── PAGE ────────────────────────────────

export default function AnalyticsPage(): ReactNode {
  const router = useRouter();
  const { isReady, isAuthenticated } = useRequireAuth();
  useRequireStudy();
  const { currentStudyId, studiesLoaded } = useStudy();
  const { user } = useAuth();

  const [stats, setStats] = useState<StudyStats | null>(null);
  const [allProblems, setAllProblems] = useState<Problem[]>([]);
  const [myNickname, setMyNickname] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  const fade = (delay = 0): CSSProperties => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(16px)',
    transition: `opacity .5s cubic-bezier(.16,1,.3,1) ${delay}s, transform .5s cubic-bezier(.16,1,.3,1) ${delay}s`,
  });

  const myId = useMemo(() => getCurrentUserId(), []);
  const userName = myNickname ?? user?.email?.split('@')[0] ?? '사용자';

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

  // 닉네임 로드
  useEffect(() => {
    if (!currentStudyId || !myId) return;
    studyApi.getMembers(currentStudyId).then((members) => {
      const me = members.find((m) => m.user_id === myId);
      if (me?.nickname) setMyNickname(me.nickname);
    }).catch(() => {});
  }, [currentStudyId, myId]);

  useEffect(() => {
    if (!isAuthenticated || !studiesLoaded) return;
    if (currentStudyId) {
      void loadData();
    } else {
      setIsLoading(false);
    }
  }, [isAuthenticated, studiesLoaded, currentStudyId, loadData]);

  // ─── API 통계 계산 ────────────────────

  const myStats = useMemo(() => {
    if (!stats?.byMember.length || !myId) return { count: 0, doneCount: 0 };
    const me = stats.byMember.find((m) => m.userId === myId);
    return me ? { count: me.count, doneCount: me.doneCount } : { count: 0, doneCount: 0 };
  }, [stats, myId]);

  const myUniqueProblemCount = useMemo(() => {
    if (!stats?.byWeekPerUser.length || !myId) return 0;
    return stats.byWeekPerUser
      .filter((r) => r.userId === myId)
      .reduce((sum, r) => sum + r.count, 0);
  }, [stats, myId]);

  const myCompletionPct = allProblems.length > 0
    ? Math.round((myUniqueProblemCount / allProblems.length) * 100)
    : 0;

  const myWeeklyData = useMemo(() => {
    if (!myId) return [];
    const myWeekMap = new Map<string, number>();
    for (const r of stats?.byWeekPerUser ?? []) {
      if (r.userId === myId) myWeekMap.set(r.week, r.count);
    }
    const allWeeks = new Set<string>();
    for (const p of allProblems) allWeeks.add(p.weekNumber);
    for (const w of myWeekMap.keys()) allWeeks.add(w);
    return Array.from(allWeeks)
      .map((week) => ({ week, count: myWeekMap.get(week) ?? 0 }))
      .sort((a, b) => parseWeekKey(a.week) - parseWeekKey(b.week));
  }, [stats, myId, allProblems]);

  const myProblemIds = useMemo(
    () => new Set(stats?.solvedProblemIds ?? []),
    [stats],
  );

  const tagDistribution = useMemo(() => {
    const countMap = new Map<string, number>();
    for (const p of allProblems) {
      if (!myProblemIds.has(p.id)) continue;
      const tags = p.tags?.length ? p.tags : ['미분류'];
      for (const tag of tags) countMap.set(tag, (countMap.get(tag) ?? 0) + 1);
    }
    return Array.from(countMap.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  }, [allProblems, myProblemIds]);

  // ─── LOADING ───────────────────────────

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
        <div style={fade(0)}>
          <h1 className="text-[22px] font-bold tracking-tight text-text">내 통계</h1>
          <p className="mt-0.5 text-sm text-text-3">
            {userName}님의 알고리즘 학습 현황
          </p>
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
              <div className="flex w-12 h-12 items-center justify-center rounded-full bg-bg-alt">
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
                <Skeleton key={i} height={80} />
              ))}
            </div>
            <Skeleton height={260} />
            <Skeleton height={300} />
          </div>
        )}

        {/* 데이터 없음 */}
        {!isLoading && currentStudyId && stats && stats.totalSubmissions === 0 && (
          <Card className="p-8">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="flex w-12 h-12 items-center justify-center rounded-full bg-bg-alt">
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

        {/* 차트 영역 */}
        {!isLoading && currentStudyId && stats && stats.totalSubmissions > 0 && (
          <AnalyticsCharts
            totalSubmissions={myStats.count}
            solvedProblems={myUniqueProblemCount}
            completionPct={myCompletionPct}
            avgAIScore={myStats.doneCount > 0 ? Math.round(myStats.doneCount / myStats.count * 100) : 0}
            streak={0}
            streakRank=""
            weeklyData={myWeeklyData}
            aiScoreData={[]}
            difficultyData={[]}
            tagData={tagDistribution}
            userName={userName}
          />
        )}
      </div>
    </AppLayout>
  );
}
