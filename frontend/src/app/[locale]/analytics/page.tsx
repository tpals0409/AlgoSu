/**
 * @file 통계 페이지 (Figma v3 — 내 통계)
 * @domain analytics
 * @layer page
 * @related AppLayout, StudyContext, AnalyticsCharts
 */

'use client';

import { useState, useEffect, useCallback, useMemo, type ReactNode, type CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import dynamic from 'next/dynamic';
import { BarChart3 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { AdBanner } from '@/components/ad/AdBanner';
import { AD_SLOTS } from '@/lib/constants/adSlots';
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
import { DIFFICULTY_COLORS, DIFFICULTIES } from '@/lib/constants';

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
  if (!m) return 0;
  const month = Number(m[1]);
  const week = Number(m[2]);
  // 현재 월 기준으로 연도를 추정하여 연도 경계(12월→1월) 정렬 문제 해결
  const now = new Date();
  const curMonth = now.getMonth() + 1;
  const curYear = now.getFullYear();
  const year = month > curMonth + 6 ? curYear - 1 : curYear;
  return year * 10000 + month * 100 + week;
}

// ─── PAGE ────────────────────────────────

export default function AnalyticsPage(): ReactNode {
  const t = useTranslations('dashboard');
  const router = useRouter();
  const { isReady, isAuthenticated } = useRequireAuth();
  useRequireStudy();
  const { currentStudyId, studiesLoaded, problemsVersion } = useStudy();
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

  // AuthContext에서 user.id 직접 사용 (httpOnly Cookie 인증)
  const myId = user?.id ?? null;
  const userName = myNickname ?? user?.email?.split('@')[0] ?? t('analyticsSection.defaultUser');

  const loadData = useCallback(async () => {
    if (!currentStudyId) return;
    setIsLoading(true);
    setError(null);
    try {
      const results = await Promise.allSettled([
        studyApi.getStats(currentStudyId),
        problemApi.findAll(),
        studyApi.getMembers(currentStudyId),
      ]);
      if (results[0].status === 'fulfilled') {
        setStats(results[0].value as StudyStats);
      } else {
        setError(t('analyticsSection.errors.statsFailed'));
      }
      if (results[1].status === 'fulfilled') {
        setAllProblems((results[1].value as Problem[]) ?? []);
      }
      if (results[2].status === 'fulfilled') {
        const memberData = results[2].value as { user_id: string; nickname?: string; email?: string }[];
        const me = memberData.find((m) => m.user_id === myId);
        if (me?.nickname) setMyNickname(me.nickname);
      }
    } catch {
      setError(t('analyticsSection.errors.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [currentStudyId, myId, t]);

  useEffect(() => {
    if (!isAuthenticated || !studiesLoaded) return;
    if (currentStudyId) {
      void loadData();
    } else {
      setIsLoading(false);
    }
  }, [isAuthenticated, studiesLoaded, currentStudyId, loadData]);

  // 문제 등록/삭제 시 problemsVersion 변경 → refetch
  useEffect(() => {
    if (isAuthenticated && studiesLoaded && currentStudyId && problemsVersion > 0) {
      void loadData();
    }
  }, [problemsVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── API 통계 계산 ────────────────────

  const activeProblemIds = useMemo(() => new Set(allProblems.map((p) => p.id)), [allProblems]);

  // 내 제출 통계 — 백엔드 byMember 집계 사용 (recentSubmissions limit 무관)
  const myStats = useMemo(() => {
    if (!stats || !myId) return { count: 0, doneCount: 0 };
    const me = stats.byMember.find((m) => m.userId === myId);
    if (!me) return { count: 0, doneCount: 0 };
    return { count: me.uniqueProblemCount, doneCount: me.uniqueDoneCount };
  }, [stats, myId]);

  // 내가 완료(DONE)한 고유 문제 ID — 백엔드 solvedProblemIds 집계 사용
  const myDoneProblemIds = useMemo(() => {
    if (!stats) return new Set<string>();
    return new Set(stats.solvedProblemIds ?? []);
  }, [stats]);

  const myUniqueProblemCount = myDoneProblemIds.size;

  const myCompletionPct = allProblems.length > 0
    ? Math.round((myUniqueProblemCount / allProblems.length) * 100)
    : 0;

  const myWeeklyData = useMemo(() => {
    if (!myId || !stats) return [];

    // problemId → weekNumber 매핑
    const problemWeekMap = new Map<string, string>();
    for (const p of allProblems) problemWeekMap.set(p.id, p.weekNumber);

    // byWeekPerUser가 있으면 사용, 없으면 userSubmissions에서 도출
    const myWeekMap = new Map<string, number>();
    if (stats.byWeekPerUser.length > 0) {
      for (const r of stats.byWeekPerUser) {
        if (r.userId === myId) myWeekMap.set(r.week, r.count);
      }
    } else {
      // 유저 전체 제출에서 주차별 고유 문제 수 집계
      const weekProblemSeen = new Map<string, Set<string>>();
      for (const sub of stats.userSubmissions ?? []) {
        if (!activeProblemIds.has(sub.problemId)) continue;
        const week = problemWeekMap.get(sub.problemId);
        if (!week) continue;
        if (!weekProblemSeen.has(week)) weekProblemSeen.set(week, new Set());
        if (!weekProblemSeen.get(week)!.has(sub.problemId)) {
          weekProblemSeen.get(week)!.add(sub.problemId);
          myWeekMap.set(week, (myWeekMap.get(week) ?? 0) + 1);
        }
      }
    }

    const allWeeks = new Set<string>();
    for (const p of allProblems) allWeeks.add(p.weekNumber);
    for (const w of myWeekMap.keys()) allWeeks.add(w);
    return Array.from(allWeeks)
      .map((week) => ({ week, count: myWeekMap.get(week) ?? 0 }))
      .sort((a, b) => parseWeekKey(a.week) - parseWeekKey(b.week));
  }, [stats, myId, allProblems, activeProblemIds]);

  // 내가 풀이한 문제 ID (태그 분포 계산용)
  const myProblemIds = myDoneProblemIds;

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
        <p className="text-sm text-text-3">{t('analyticsSection.loading')}</p>
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* 헤더 */}
        <div style={fade(0)}>
          <h1 className="text-[22px] font-bold tracking-tight text-text">{t('analyticsSection.heading')}</h1>
          <p className="mt-0.5 text-sm text-text-3">
            {t('analyticsSection.userStats', { name: userName })}
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
                <p className="text-sm font-medium text-text">{t('analyticsSection.empty.noStudy')}</p>
                <p className="mt-1 text-[11px] text-text-3">
                  {t('analyticsSection.empty.noStudyDesc')}
                </p>
              </div>
              <Button variant="primary" size="sm" onClick={() => router.push('/studies')}>
                {t('analyticsSection.empty.studyList')}
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
                <p className="text-sm font-medium text-text">{t('analyticsSection.empty.noData')}</p>
                <p className="mt-1 text-[11px] text-text-3">
                  {t('analyticsSection.empty.noDataDesc')}
                </p>
              </div>
              <Button variant="primary" size="sm" onClick={() => router.push('/problems')}>
                {t('analyticsSection.empty.problemList')}
              </Button>
            </div>
          </Card>
        )}

        {/* 차트 영역 + 하단 광고 */}
        {!isLoading && currentStudyId && stats && stats.totalSubmissions > 0 && (
          <AnalyticsCharts
            totalSubmissions={myStats.count}
            solvedProblems={myUniqueProblemCount}
            completionPct={myCompletionPct}
            avgAIScore={(() => {
              // 유저 전체 제출에서 문제별 최고 점수만 반영 (같은 문제 1회)
              const bestByProblem = new Map<string, number>();
              for (const s of stats.userSubmissions ?? []) {
                if (s.aiScore == null) continue;
                const prev = bestByProblem.get(s.problemId) ?? 0;
                if (s.aiScore > prev) bestByProblem.set(s.problemId, s.aiScore);
              }
              const scores = Array.from(bestByProblem.values());
              return scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
            })()}
            streak={myWeeklyData.length > 0 ? (() => {
              // 최근 주차부터 연속 제출 주 수 계산
              let consecutive = 0;
              const sorted = [...myWeeklyData].sort((a, b) => parseWeekKey(b.week) - parseWeekKey(a.week));
              for (const w of sorted) {
                if (w.count > 0) consecutive++;
                else break;
              }
              return consecutive;
            })() : 0}
            streakRank={t('analyticsSection.weeks.recent', { count: myWeeklyData.length })}
            weeklyData={myWeeklyData}
            aiScoreData={(() => {
              // 유저 전체 제출에서 문제별 최고 점수만 추이에 반영 (같은 문제 1회)
              const bestByProblem = new Map<string, { score: number; createdAt: string; title: string }>();
              for (const s of stats.userSubmissions ?? []) {
                if (s.aiScore == null) continue;
                const prev = bestByProblem.get(s.problemId);
                if (!prev || s.aiScore > prev.score) {
                  bestByProblem.set(s.problemId, {
                    score: s.aiScore,
                    createdAt: s.createdAt,
                    title: s.problemId.slice(0, 8),
                  });
                }
              }
              return Array.from(bestByProblem.values())
                .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                .map((v) => ({
                  date: new Date(v.createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }),
                  score: v.score,
                  problem: v.title,
                }));
            })()}
            difficultyData={(() => {
              const DIFFICULTY_ORDER = DIFFICULTIES.map((key) => ({ key, color: DIFFICULTY_COLORS[key] }));
              const countMap = new Map<string, number>();
              for (const p of allProblems) {
                if (!myProblemIds.has(p.id)) continue;
                const d = p.difficulty ?? '미분류';
                countMap.set(d, (countMap.get(d) ?? 0) + 1);
              }
              return DIFFICULTY_ORDER
                .filter((d) => countMap.has(d.key))
                .map((d) => ({ tier: d.key, count: countMap.get(d.key)!, color: d.color }));
            })()}
            tagData={tagDistribution}
            userName={userName}
          />
        )}

        {/* 차트 하단 광고 */}
        <AdBanner slot={AD_SLOTS.ANALYTICS_BOTTOM} className="mt-6" />
      </div>
    </AppLayout>
  );
}
