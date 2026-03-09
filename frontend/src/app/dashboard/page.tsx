/**
 * @file Dashboard 페이지 (v2 전면 교체 + dynamic import 최적화)
 * @domain dashboard
 * @layer page
 * @related AppLayout, AuthContext, StudyContext, useRequireAuth, useAnimVal
 */

'use client';

import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  FileText,
  Users,
  BarChart3,
  Github,
  MessageCircle,
  X,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useStudy } from '@/contexts/StudyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useRequireStudy } from '@/hooks/useRequireStudy';
import { useAnimVal } from '@/hooks/useAnimVal';
import {
  studyApi,
  submissionApi,
  problemApi,
  type StudyStats,
  type StudyMember,
  type Submission,
  type Problem,
} from '@/lib/api';
import { cn, getCurrentWeekLabel } from '@/lib/utils';

// ─── DYNAMIC IMPORTS (번들 최적화) ────────

const DashboardWeeklyChart = dynamic(
  () => import('@/components/dashboard/DashboardWeeklyChart'),
  {
    loading: () => (
      <div className="min-h-[260px] rounded-card border border-border bg-bg-card p-6 shadow-card">
        <Skeleton width="40%" height={20} className="mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton width={56} height={14} />
              <Skeleton className="flex-1" height={22} />
              <Skeleton width={28} height={14} />
            </div>
          ))}
        </div>
      </div>
    ),
  },
);

const DashboardThisWeek = dynamic(
  () => import('@/components/dashboard/DashboardThisWeek'),
  {
    loading: () => (
      <div className="min-h-[220px] rounded-card border border-border bg-bg-card shadow-card overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <Skeleton width={120} height={18} />
        </div>
        <div className="space-y-3 p-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} height={36} />
          ))}
        </div>
      </div>
    ),
  },
);

const DashboardTwoColumn = dynamic(
  () => import('@/components/dashboard/DashboardTwoColumn'),
  {
    loading: () => (
      <div className="grid gap-3.5 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="min-h-[240px] rounded-card border border-border bg-bg-card shadow-card overflow-hidden">
            <div className="border-b border-border px-4 py-3">
              <Skeleton width={100} height={16} />
            </div>
            <div className="space-y-3 p-4">
              {Array.from({ length: 3 }).map((_, j) => (
                <Skeleton key={j} height={36} />
              ))}
            </div>
          </div>
        ))}
      </div>
    ),
  },
);

// ─── STAT CARD ───────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  loading,
  href,
  animRef,
  valueColor,
}: {
  readonly icon: typeof FileText;
  readonly label: string;
  readonly value: string | number;
  readonly loading: boolean;
  readonly href?: string;
  readonly animRef?: React.RefObject<HTMLDivElement | null>;
  readonly valueColor?: string;
}): ReactNode {
  const content = (
    <div className="flex items-center gap-3" ref={animRef}>
      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-bg-alt">
        <Icon className="h-4 w-4 text-primary" aria-hidden />
      </div>
      <div className="min-w-0">
        {loading ? (
          <Skeleton height={28} width={60} />
        ) : (
          <p className={cn('whitespace-nowrap font-mono text-xl sm:text-[28px] font-bold leading-none tracking-tight', valueColor ?? 'text-text')}>
            {value}
          </p>
        )}
        <p className="mt-1 whitespace-nowrap text-xs font-medium text-text-3">{label}</p>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="h-full">
        <Card className="h-full cursor-pointer p-5 transition-colors hover:bg-bg-alt">
          {content}
        </Card>
      </Link>
    );
  }

  return <Card className="h-full p-5">{content}</Card>;
}

// ─── RENDER ──────────────────────────────

export default function DashboardPage(): ReactNode {
  const router = useRouter();
  const { isReady } = useRequireAuth();
  const { isStudyReady } = useRequireStudy();
  const { isAuthenticated, githubConnected } = useAuth();
  const { user } = useAuth();
  const { currentStudyId, currentStudyName, studiesLoaded } = useStudy();


  const [stats, setStats] = useState<StudyStats | null>(null);
  const [members, setMembers] = useState<StudyMember[]>([]);
  const [recentSubmissions, setRecentSubmissions] = useState<Submission[]>([]);
  const [activeProblems, setActiveProblems] = useState<Problem[]>([]);
  const [allProblems, setAllProblems] = useState<Problem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sectionErrors, setSectionErrors] = useState<{
    stats: string | null;
    submissions: string | null;
    problems: string | null;
    members: string | null;
  }>({ stats: null, submissions: null, problems: null, members: null });
  const [mounted, setMounted] = useState(false);
  const [weekViewUserId, setWeekViewUserId] = useState<string | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setBannerDismissed(sessionStorage.getItem('algosu:github-banner-dismissed') === 'true');
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // ─── DATA FETCH ──────────────────────────

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setSectionErrors({ stats: null, submissions: null, problems: null, members: null });

    try {
      const results = await Promise.allSettled([
        currentStudyId ? studyApi.getStats(currentStudyId, getCurrentWeekLabel()) : Promise.resolve(null),
        submissionApi.list({ page: 1, limit: 5 }),
        problemApi.findAll(),
        currentStudyId ? studyApi.getMembers(currentStudyId) : Promise.resolve([]),
        problemApi.findAllProblems(),
      ]);

      const errors = { stats: null as string | null, submissions: null as string | null, problems: null as string | null, members: null as string | null };

      if (results[0].status === 'fulfilled' && results[0].value) {
        setStats(results[0].value as StudyStats);
      } else if (results[0].status === 'rejected') {
        errors.stats = '통계를 불러올 수 없습니다.';
      }

      if (results[1].status === 'fulfilled') {
        const paginated = results[1].value as { data: Submission[]; meta: unknown };
        setRecentSubmissions(paginated.data ?? []);
      } else {
        errors.submissions = '최근 제출 목록을 불러올 수 없습니다.';
      }

      if (results[2].status === 'fulfilled') {
        setActiveProblems((results[2].value as Problem[]) ?? []);
      } else {
        errors.problems = '문제 목록을 불러올 수 없습니다.';
      }

      if (results[3].status === 'fulfilled') {
        setMembers((results[3].value as StudyMember[]) ?? []);
      } else if (results[3].status === 'rejected') {
        errors.members = '멤버 목록을 불러올 수 없습니다.';
      }

      if (results[4].status === 'fulfilled') {
        setAllProblems((results[4].value as Problem[]) ?? []);
      } else {
        errors.problems = errors.problems ?? '문제 목록을 불러올 수 없습니다.';
      }

      setSectionErrors(errors);

      const allFailed = results.every((r) => r.status === 'rejected');
      if (allFailed) {
        setError('대시보드 데이터를 불러오는 데 실패했습니다.');
      }
    } catch {
      setError('대시보드 데이터를 불러오는 데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [currentStudyId]);


  useEffect(() => {
    if (isAuthenticated && studiesLoaded && currentStudyId) {
      void loadDashboard();
    }
  }, [isAuthenticated, studiesLoaded, currentStudyId, loadDashboard]);

  // ─── DERIVED STATE ────────────────────────

  // httpOnly Cookie 인증에서는 localStorage 토큰이 없으므로
  // members 목록에서 email 매칭으로 현재 사용자 ID를 도출
  const myUserId = useMemo(() => {
    if (!user?.email || members.length === 0) return null;
    const me = members.find((m) => m.email === user.email);
    return me?.user_id ?? null;
  }, [user, members]);

  const activeProblemIds = useMemo(() => new Set(allProblems.map((p) => p.id)), [allProblems]);

  const problemTitleMap = useMemo(() => {
    return new Map(allProblems.map((p) => [p.id, p.title]));
  }, [allProblems]);

  const submittedProblemIds = useMemo(() => {
    return new Set(recentSubmissions.map((s) => s.problemId));
  }, [recentSubmissions]);

  const currentWeekProblems = useMemo(() => {
    const currentWeek = getCurrentWeekLabel();
    const weekProblems = activeProblems.filter((p) => p.weekNumber === currentWeek);
    // 미제출 문제를 상단에, 제출 완료 문제를 하단에
    return weekProblems.sort((a, b) => {
      const aSubmitted = submittedProblemIds.has(a.id) ? 1 : 0;
      const bSubmitted = submittedProblemIds.has(b.id) ? 1 : 0;
      return aSubmitted - bSubmitted;
    });
  }, [activeProblems, submittedProblemIds]);




  // 내 제출 중 활성 문제만, 같은 문제는 1회만 집계
  const myStats = useMemo(() => {
    if (!stats || !myUserId) return { count: 0, doneCount: 0 };
    const submitted = new Set<string>();
    const done = new Set<string>();
    for (const s of stats.recentSubmissions ?? []) {
      if (s.userId !== myUserId || !activeProblemIds.has(s.problemId)) continue;
      submitted.add(s.problemId);
      if (s.sagaStep === 'DONE') done.add(s.problemId);
    }
    return { count: submitted.size, doneCount: done.size };
  }, [stats, myUserId, activeProblemIds]);

  const myUniqueProblemCount = useMemo(() => {
    if (!stats || !myUserId) return 0;
    // recentSubmissions에서 DONE + 활성 문제의 고유 문제 수
    const doneIds = new Set(
      (stats.recentSubmissions ?? [])
        .filter((s) => s.userId === myUserId && s.sagaStep === 'DONE' && activeProblemIds.has(s.problemId))
        .map((s) => s.problemId),
    );
    return doneIds.size;
  }, [stats, myUserId, activeProblemIds]);

  // AI 코드분석 평균 점수 (활성 문제별 최고 점수 기준, 같은 문제 1회)
  const myAvgAIScore = useMemo(() => {
    if (!stats || !myUserId) return 0;
    const bestByProblem = new Map<string, number>();
    for (const s of stats.recentSubmissions ?? []) {
      if (s.userId !== myUserId || s.aiScore == null || !activeProblemIds.has(s.problemId)) continue;
      const prev = bestByProblem.get(s.problemId) ?? 0;
      if (s.aiScore > prev) bestByProblem.set(s.problemId, s.aiScore);
    }
    const scores = Array.from(bestByProblem.values());
    return scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  }, [stats, myUserId, activeProblemIds]);

  const myCompletionPct = allProblems.length > 0
    ? Math.round((myUniqueProblemCount / allProblems.length) * 100)
    : 0;

  const problemCountByWeek = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of allProblems) {
      map.set(p.weekNumber, (map.get(p.weekNumber) ?? 0) + 1);
    }
    return map;
  }, [allProblems]);

  // 주차별 뷰 사이클
  const weekViewCycle = useMemo(() => {
    const otherIds = members.filter((m) => m.user_id !== myUserId).map((m) => m.user_id);
    return [null, myUserId, ...otherIds] as (string | null)[];
  }, [members, myUserId]);

  const cycleWeekView = useCallback(() => {
    setWeekViewUserId((prev) => {
      const idx = weekViewCycle.indexOf(prev);
      return weekViewCycle[(idx + 1) % weekViewCycle.length];
    });
  }, [weekViewCycle]);

  const parseWeekKey = useCallback((w: string) => {
    const m = w.match(/^(\d+)월(\d+)주차$/);
    if (!m) return 0;
    const month = Number(m[1]);
    const week = Number(m[2]);
    // 현재 월 기준으로 연도를 추정하여 연도 경계(12월→1월) 정렬 문제 해결
    const now = new Date();
    const curMonth = now.getMonth() + 1; // 1-12
    const curYear = now.getFullYear();
    // 현재 월보다 6개월 이상 뒤의 월이면 전년도로 간주
    const year = month > curMonth + 6 ? curYear - 1 : curYear;
    return year * 10000 + month * 100 + week;
  }, []);

  const filteredByWeek = useMemo(() => {
    if (!stats) return [];

    // problemId → weekNumber 매핑
    const problemWeekMap = new Map<string, string>();
    for (const p of allProblems) problemWeekMap.set(p.id, p.weekNumber);

    // byWeekPerUser가 있으면 사용, 없으면 recentSubmissions에서 도출
    let result: { week: string; count: number }[];

    if (stats.byWeekPerUser.length > 0) {
      if (weekViewUserId === null) {
        const weekMap = new Map<string, number>();
        for (const r of stats.byWeekPerUser) {
          weekMap.set(r.week, (weekMap.get(r.week) ?? 0) + r.count);
        }
        result = Array.from(weekMap.entries()).map(([week, count]) => ({ week, count }));
      } else {
        result = stats.byWeekPerUser
          .filter((r) => r.userId === weekViewUserId)
          .map((r) => ({ week: r.week, count: r.count }));
      }
    } else {
      // recentSubmissions → 주차별 고유 문제 수 (활성 문제만)
      const weekProblemMap = new Map<string, Set<string>>();
      for (const s of stats.recentSubmissions ?? []) {
        if (weekViewUserId !== null && s.userId !== weekViewUserId) continue;
        if (!activeProblemIds.has(s.problemId)) continue;
        const week = problemWeekMap.get(s.problemId);
        if (!week) continue;
        if (!weekProblemMap.has(week)) weekProblemMap.set(week, new Set());
        weekProblemMap.get(week)!.add(s.problemId);
      }
      // allProblems의 모든 주차 포함 (제출 없는 주차도 0으로 표시)
      const allWeeks = new Set<string>();
      for (const p of allProblems) allWeeks.add(p.weekNumber);
      result = Array.from(allWeeks).map((week) => ({
        week,
        count: weekProblemMap.get(week)?.size ?? 0,
      }));
    }

    return result.sort((a, b) => parseWeekKey(b.week) - parseWeekKey(a.week));
  }, [stats, weekViewUserId, parseWeekKey, allProblems, activeProblemIds]);

  const getViewLabel = useCallback((userId: string | null) => {
    if (userId === null) return '전체';
    if (userId === myUserId) return '내 풀이';
    const member = members.find((m) => m.user_id === userId);
    return member?.nickname ?? member?.username ?? member?.email?.split('@')[0] ?? userId.slice(0, 8);
  }, [members, myUserId]);

  const weekViewLabel = useMemo(() => getViewLabel(weekViewUserId), [weekViewUserId, getViewLabel]);

  const statsLoading = isLoading || (currentStudyId != null && stats === null && !error);

  // animated counters (ref만 StatCard에 전달)
  const [submissionRef] = useAnimVal(myStats.count);
  const [memberRef] = useAnimVal(members.length);
  const [completionRef] = useAnimVal(myCompletionPct);

  // ─── LOADING SCREEN ───────────────────────

  if (!isReady || !isStudyReady) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg">
        <LoadingSpinner size="lg" color="primary" />
        <p className="text-sm text-text-3">로딩 중...</p>
      </div>
    );
  }

  // ─── FADE HELPER ──────────────────────────

  const fade = (delay = 0): React.CSSProperties => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(16px)',
    transition: `opacity .5s cubic-bezier(.16,1,.3,1) ${delay}s, transform .5s cubic-bezier(.16,1,.3,1) ${delay}s`,
  });

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* ── HEADER ── */}
        <div className="flex items-center justify-between" style={fade(0)}>
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-text">
              {(() => {
                const me = myUserId ? members.find((m) => m.user_id === myUserId) : null;
                const displayName = me?.nickname ?? user?.email?.split('@')[0];
                return displayName ? `안녕하세요, ${displayName}님 👋` : '안녕하세요 👋';
              })()}
            </h1>
            <p className="mt-0.5 text-xs text-text-3">
              오늘도 꾸준히 성장하는 하루 되세요.
            </p>
          </div>
        </div>

        {error && (
          <Alert variant="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* ── GITHUB ONBOARDING BANNER ── */}
        {!githubConnected && !isLoading && !bannerDismissed && (
          <Card className="border-warning/30 bg-warning-soft" style={fade(0.06)}>
            <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Github className="h-5 w-5 shrink-0 text-warning" aria-hidden />
                <div>
                  <p className="text-[13px] font-medium text-text">GitHub 연동이 필요합니다</p>
                  <p className="text-[11px] text-text-3">코드를 제출하려면 GitHub 계정을 먼저 연동해주세요.</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => router.push('/github-link')}>
                  연동하기
                </Button>
                <button
                  type="button"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-text-3 transition-colors hover:bg-bg-alt hover:text-text"
                  aria-label="배너 닫기"
                  onClick={() => {
                    setBannerDismissed(true);
                    sessionStorage.setItem('algosu:github-banner-dismissed', 'true');
                  }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </Card>
        )}

        {/* ── 섹션별 에러 배너 ── */}
        {(sectionErrors.stats || sectionErrors.members) && (
          <Alert variant="error" style={fade(0.07)}>
            {[sectionErrors.stats, sectionErrors.members].filter(Boolean).join(' ')}
          </Alert>
        )}

        {/* ── STAT CARDS + STUDY ROOM (4열) ── */}
        {currentStudyId && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3.5 lg:grid-cols-4" style={fade(0.08)}>
            <StatCard
              icon={FileText}
              label="제출 수"
              value={statsLoading ? '' : myStats.count}
              loading={statsLoading}
              href="/submissions"
              animRef={submissionRef}
            />
            <StatCard
              icon={Users}
              label={currentStudyName ?? '스터디'}
              value={statsLoading ? '' : members.length}
              loading={statsLoading}
              href={currentStudyId ? `/studies/${currentStudyId}` : undefined}
              animRef={memberRef}
              valueColor="text-primary"
            />
            <StatCard
              icon={BarChart3}
              label="통계"
              value={statsLoading ? '' : `${myAvgAIScore}점`}
              loading={statsLoading}
              href="/analytics"
              animRef={completionRef}
              valueColor="text-primary"
            />
            {/* 스터디룸 카드 - 그라데이션 보라 */}
            <Link href={currentStudyId ? `/studies/${currentStudyId}/room` : '/study-room'} className="h-full">
              <Card className="group h-full cursor-pointer p-5 text-white transition-all hover:brightness-105" style={{ ...fade(0.08), background: 'var(--gradient-brand)' }}>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-white/20">
                    <MessageCircle className="h-4 w-4 text-white" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <p className="whitespace-nowrap text-xl sm:text-[28px] font-bold leading-none tracking-tight text-white">스터디룸</p>
                    <p className="mt-1 whitespace-nowrap text-xs font-medium text-white/70">입장하기</p>
                  </div>
                </div>
              </Card>
            </Link>
          </div>
        )}

        {/* ── 문제 섹션 에러 배너 ── */}
        {sectionErrors.problems && (
          <Alert variant="error" style={fade(0.14)}>
            {sectionErrors.problems}
          </Alert>
        )}

        {/* ── WEEKLY CHART (dynamic) ── */}
        {/* ── MIDDLE ROW: 주차별 차트(좌) + 진행 중인 문제(우) ── */}
        {currentStudyId && (
          <div className="grid gap-3.5 md:grid-cols-[3fr_2fr]" style={fade(0.16)}>
            {/* 주차별 제출 현황 차트 */}
            {stats && stats.totalSubmissions > 0 ? (
              <DashboardWeeklyChart
                filteredByWeek={filteredByWeek}
                weekViewLabel={weekViewLabel}
                problemCountByWeek={problemCountByWeek}
                members={members}
                weekViewUserId={weekViewUserId}
                mounted={mounted}
                onCycleView={cycleWeekView}
                fadeStyle={{}}
              />
            ) : (
              <div className="rounded-card border border-border bg-bg-card p-6 shadow-card">
                <p className="text-sm text-text-3">아직 제출 데이터가 없습니다.</p>
              </div>
            )}

            {/* 진행 중인 문제 */}
            <DashboardThisWeek
              currentWeekProblems={currentWeekProblems}
              submittedProblemIds={submittedProblemIds}
              isLoading={isLoading}
              fadeStyle={{}}
            />
          </div>
        )}

        {/* ── 제출 섹션 에러 배너 ── */}
        {sectionErrors.submissions && (
          <Alert variant="error" style={fade(0.22)}>
            {sectionErrors.submissions}
          </Alert>
        )}

        {/* ── BOTTOM: 최근 제출 (풀 너비) ── */}
        <DashboardTwoColumn
          recentSubmissions={recentSubmissions}
          upcomingDeadlines={[]}
          submittedProblemIds={submittedProblemIds}
          problemTitleMap={problemTitleMap}
          allProblems={allProblems}
          isLoading={isLoading}
          fadeStyle={fade(0.24)}
        />
      </div>
    </AppLayout>
  );
}

