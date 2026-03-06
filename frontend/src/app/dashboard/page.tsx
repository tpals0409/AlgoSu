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
  CheckCircle2,
  RefreshCw,
  Github,
  BookOpenCheck,
  ChevronRight,
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
      <div className="rounded-card border border-border bg-bg-card p-6 shadow-card">
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
      <div className="rounded-card border border-border bg-bg-card shadow-card overflow-hidden">
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
          <div key={i} className="rounded-card border border-border bg-bg-card shadow-card overflow-hidden">
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
      <div>
        {loading ? (
          <Skeleton height={28} width={60} />
        ) : (
          <p className={cn('font-mono text-[28px] font-bold leading-none tracking-tight', valueColor ?? 'text-text')}>
            {value}
          </p>
        )}
        <p className="mt-1 text-[11px] text-text-3">{label}</p>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href}>
        <Card className="cursor-pointer p-5 transition-colors hover:bg-bg-alt">
          {content}
        </Card>
      </Link>
    );
  }

  return <Card className="p-5">{content}</Card>;
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
  const [mounted, setMounted] = useState(false);
  const [weekViewUserId, setWeekViewUserId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // ─── DATA FETCH ──────────────────────────

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const results = await Promise.allSettled([
        currentStudyId ? studyApi.getStats(currentStudyId, getCurrentWeekLabel()) : Promise.resolve(null),
        submissionApi.list({ page: 1, limit: 5 }),
        problemApi.findAll(),
        currentStudyId ? studyApi.getMembers(currentStudyId) : Promise.resolve([]),
        problemApi.findAllIncludingClosed(),
      ]);

      if (results[0].status === 'fulfilled' && results[0].value) {
        setStats(results[0].value as StudyStats);
      } else {
        setStats(null);
      }

      if (results[1].status === 'fulfilled') {
        const paginated = results[1].value as { data: Submission[]; meta: unknown };
        setRecentSubmissions(paginated.data ?? []);
      }

      if (results[2].status === 'fulfilled') {
        setActiveProblems((results[2].value as Problem[]) ?? []);
      }

      if (results[3].status === 'fulfilled') {
        setMembers((results[3].value as StudyMember[]) ?? []);
      }

      if (results[4].status === 'fulfilled') {
        setAllProblems((results[4].value as Problem[]) ?? []);
      }

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

  const upcomingDeadlines = useMemo(() => {
    const now = new Date();
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return activeProblems
      .filter(
        (p) =>
          p.status === 'ACTIVE' &&
          p.deadline &&
          new Date(p.deadline) > now &&
          new Date(p.deadline) <= sevenDaysLater,
      )
      .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
      .slice(0, 5);
  }, [activeProblems]);

  const myStats = useMemo(() => {
    if (!stats?.byMember.length || !myUserId) return { count: 0, doneCount: 0 };
    const me = stats.byMember.find((m) => m.userId === myUserId);
    return me ? { count: me.count, doneCount: me.doneCount } : { count: 0, doneCount: 0 };
  }, [stats, myUserId]);

  const myUniqueProblemCount = useMemo(() => {
    if (!stats?.byWeekPerUser.length || !myUserId) return 0;
    return stats.byWeekPerUser
      .filter((r) => r.userId === myUserId)
      .reduce((sum, r) => sum + r.count, 0);
  }, [stats, myUserId]);

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
    return m ? Number(m[1]) * 100 + Number(m[2]) : 0;
  }, []);

  const filteredByWeek = useMemo(() => {
    if (!stats) return [];
    let result: { week: string; count: number }[];
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
    return result.sort((a, b) => parseWeekKey(b.week) - parseWeekKey(a.week));
  }, [stats, weekViewUserId, parseWeekKey]);

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
            <h1 className="text-[22px] font-bold tracking-tight text-text">대시보드</h1>
            <p className="mt-0.5 text-xs text-text-3">
              {(() => {
                const me = myUserId ? members.find((m) => m.user_id === myUserId) : null;
                const displayName = me?.nickname ?? user?.email;
                return displayName ? `${displayName}님, 안녕하세요!` : '환영합니다';
              })()}
              {currentStudyName ? ` — ${currentStudyName}` : ''}
            </p>
          </div>
          {currentStudyId && (
            <button
              type="button"
              className="flex h-[34px] items-center gap-1.5 rounded-btn border border-border bg-transparent px-3.5 text-xs font-medium text-text-2 transition-colors hover:text-text disabled:opacity-50"
              onClick={() => void loadDashboard()}
              disabled={isLoading}
            >
              <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
              새로고침
            </button>
          )}
        </div>

        {error && (
          <Alert variant="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* ── GITHUB ONBOARDING BANNER ── */}
        {!githubConnected && !isLoading && (
          <Card className="border-warning/30 bg-warning-soft" style={fade(0.06)}>
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <Github className="h-5 w-5 text-warning" aria-hidden />
                <div>
                  <p className="text-[13px] font-medium text-text">GitHub 연동이 필요합니다</p>
                  <p className="text-[11px] text-text-3">코드를 제출하려면 GitHub 계정을 먼저 연동해주세요.</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => router.push('/github-link')}>
                연동하기
              </Button>
            </div>
          </Card>
        )}

        {/* ── STAT CARDS ── */}
        {currentStudyId && (
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3" style={fade(0.08)}>
            <StatCard
              icon={FileText}
              label="내 제출 (이번 스터디 전체)"
              value={statsLoading ? '' : myStats.count}
              loading={statsLoading}
              href="/submissions"
              animRef={submissionRef}
              valueColor="text-primary"
            />
            <StatCard
              icon={Users}
              label="활성 멤버"
              value={statsLoading ? '' : members.length}
              loading={statsLoading}
              href={currentStudyId ? `/studies/${currentStudyId}` : undefined}
              animRef={memberRef}
            />
            <StatCard
              icon={CheckCircle2}
              label="전체 문제 기준"
              value={statsLoading ? '' : `${myCompletionPct}%`}
              loading={statsLoading}
              href="/analytics"
              animRef={completionRef}
              valueColor="text-success"
            />
          </div>
        )}

        {/* ── STUDY ROOM CARD ── */}
        {currentStudyId && (
          <Link href="/study-room">
            <Card className="group cursor-pointer border-primary/20 bg-primary-soft transition-all hover:border-primary/40 hover:shadow-md" style={fade(0.12)}>
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
                    <BookOpenCheck className="h-4 w-4 text-primary" aria-hidden />
                  </div>
                  <div>
                    <p className="text-[13px] font-medium text-text">스터디룸</p>
                    <p className="text-[11px] text-text-3">마감된 문제의 풀이를 함께 리뷰하고 토론하세요</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-text-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </div>
            </Card>
          </Link>
        )}

        {/* ── WEEKLY CHART (dynamic) ── */}
        {currentStudyId && stats && stats.byWeek.length > 0 && (
          <DashboardWeeklyChart
            filteredByWeek={filteredByWeek}
            weekViewLabel={weekViewLabel}
            problemCountByWeek={problemCountByWeek}
            members={members}
            weekViewUserId={weekViewUserId}
            mounted={mounted}
            onCycleView={cycleWeekView}
            fadeStyle={fade(0.16)}
          />
        )}

        {/* ── THIS WEEK PROBLEMS (dynamic) ── */}
        {currentStudyId && (
          <DashboardThisWeek
            currentWeekProblems={currentWeekProblems}
            submittedProblemIds={submittedProblemIds}
            isLoading={isLoading}
            fadeStyle={fade(0.2)}
          />
        )}

        {/* ── TWO COLUMN GRID (dynamic) ── */}
        <DashboardTwoColumn
          recentSubmissions={recentSubmissions}
          upcomingDeadlines={upcomingDeadlines}
          submittedProblemIds={submittedProblemIds}
          problemTitleMap={problemTitleMap}
          isLoading={isLoading}
          fadeStyle={fade(0.24)}
        />
      </div>
    </AppLayout>
  );
}
