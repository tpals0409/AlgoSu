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
  const { currentStudyId, studiesLoaded } = useStudy();


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

    // ── DEV MOCK DATA ──────────────────────────────────────────────
    if (process.env.NEXT_PUBLIC_DEV_MOCK === 'true') {
      const mockMembers: StudyMember[] = [
        { id: 'm1', study_id: 'dev-study-001', user_id: 'dev-user-001', role: 'ADMIN', joined_at: '2025-01-01T00:00:00Z', nickname: '김민준', username: 'kimmin', email: 'dev@algosu.kr', avatar_url: '' },
        { id: 'm2', study_id: 'dev-study-001', user_id: 'dev-user-002', role: 'MEMBER', joined_at: '2025-01-02T00:00:00Z', nickname: '이서연', username: 'seoyeon', email: 'user2@algosu.kr', avatar_url: '' },
        { id: 'm3', study_id: 'dev-study-001', user_id: 'dev-user-003', role: 'MEMBER', joined_at: '2025-01-02T00:00:00Z', nickname: '박지호', username: 'jiho', email: 'user3@algosu.kr', avatar_url: '' },
        { id: 'm4', study_id: 'dev-study-001', user_id: 'dev-user-004', role: 'MEMBER', joined_at: '2025-01-03T00:00:00Z', nickname: '최유진', username: 'yujin', email: 'user4@algosu.kr', avatar_url: '' },
        { id: 'm5', study_id: 'dev-study-001', user_id: 'dev-user-005', role: 'MEMBER', joined_at: '2025-01-03T00:00:00Z', nickname: '강민서', username: 'minseo', email: 'user5@algosu.kr', avatar_url: '' },
        { id: 'm6', study_id: 'dev-study-001', user_id: 'dev-user-006', role: 'MEMBER', joined_at: '2025-01-04T00:00:00Z', nickname: '정하늘', username: 'haneul', email: 'user6@algosu.kr', avatar_url: '' },
        { id: 'm7', study_id: 'dev-study-001', user_id: 'dev-user-007', role: 'MEMBER', joined_at: '2025-01-04T00:00:00Z', nickname: '한승우', username: 'seungwoo', email: 'user7@algosu.kr', avatar_url: '' },
        { id: 'm8', study_id: 'dev-study-001', user_id: 'dev-user-008', role: 'MEMBER', joined_at: '2025-01-05T00:00:00Z', nickname: '오지수', username: 'jisoo', email: 'user8@algosu.kr', avatar_url: '' },
      ];
      const mockStats: StudyStats = {
        totalSubmissions: 63,
        solvedProblemIds: ['prob-001', 'prob-003'],
        recentSubmissions: [],
        byMemberWeek: null,
        byWeek: [
          { week: '3월1주차', count: 12 },
          { week: '2월4주차', count: 18 },
          { week: '2월3주차', count: 15 },
          { week: '2월2주차', count: 10 },
          { week: '2월1주차', count: 8 },
        ],
        byMember: [
          { userId: 'dev-user-001', isMember: true, count: 12, doneCount: 10 },
          { userId: 'dev-user-002', isMember: true, count: 8, doneCount: 7 },
          { userId: 'dev-user-003', isMember: true, count: 10, doneCount: 9 },
          { userId: 'dev-user-004', isMember: true, count: 6, doneCount: 5 },
          { userId: 'dev-user-005', isMember: true, count: 9, doneCount: 8 },
        ],
        byWeekPerUser: [
          { userId: 'dev-user-001', week: '3월1주차', count: 3 },
          { userId: 'dev-user-001', week: '2월4주차', count: 4 },
          { userId: 'dev-user-001', week: '2월3주차', count: 3 },
          { userId: 'dev-user-001', week: '2월2주차', count: 1 },
          { userId: 'dev-user-001', week: '2월1주차', count: 1 },
          { userId: 'dev-user-002', week: '3월1주차', count: 2 },
          { userId: 'dev-user-002', week: '2월4주차', count: 3 },
          { userId: 'dev-user-003', week: '3월1주차', count: 2 },
          { userId: 'dev-user-003', week: '2월4주차', count: 4 },
          { userId: 'dev-user-003', week: '2월3주차', count: 4 },
        ],
      };
      const currentWeek = getCurrentWeekLabel();
      const mockActiveProblems: Problem[] = [
        { id: 'prob-001', title: '두 수의 합', weekNumber: currentWeek, status: 'ACTIVE', difficulty: 'SILVER', level: 2, deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), description: '', allowedLanguages: [] },
        { id: 'prob-002', title: '최단 경로', weekNumber: currentWeek, status: 'ACTIVE', difficulty: 'GOLD', level: 4, deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), description: '', allowedLanguages: [] },
        { id: 'prob-003', title: '이분 탐색', weekNumber: '2월4주차', status: 'ACTIVE', difficulty: 'SILVER', level: 3, deadline: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), description: '', allowedLanguages: [] },
      ];
      const mockAllProblems: Problem[] = [
        ...mockActiveProblems,
        { id: 'prob-004', title: 'BFS 탐색', weekNumber: '2월3주차', status: 'CLOSED', difficulty: 'SILVER', level: 2, deadline: '', description: '', allowedLanguages: [] },
        { id: 'prob-005', title: 'DFS와 BFS', weekNumber: '2월2주차', status: 'CLOSED', difficulty: 'GOLD', level: 3, deadline: '', description: '', allowedLanguages: [] },
        { id: 'prob-006', title: '다익스트라', weekNumber: '2월1주차', status: 'CLOSED', difficulty: 'GOLD', level: 4, deadline: '', description: '', allowedLanguages: [] },
        { id: 'prob-007', title: '플로이드 워셜', weekNumber: '1월4주차', status: 'CLOSED', difficulty: 'PLATINUM', level: 1, deadline: '', description: '', allowedLanguages: [] },
        { id: 'prob-008', title: '크루스칼', weekNumber: '1월3주차', status: 'CLOSED', difficulty: 'GOLD', level: 2, deadline: '', description: '', allowedLanguages: [] },
        { id: 'prob-009', title: '프림 알고리즘', weekNumber: '1월2주차', status: 'CLOSED', difficulty: 'GOLD', level: 5, deadline: '', description: '', allowedLanguages: [] },
        { id: 'prob-010', title: '위상 정렬', weekNumber: '1월1주차', status: 'CLOSED', difficulty: 'GOLD', level: 4, deadline: '', description: '', allowedLanguages: [] },
      ];
      const mockSubmissions: Submission[] = [
        { id: 'sub-001', problemId: 'prob-001', problemTitle: '두 수의 합', language: 'Python', sagaStep: 'DONE', createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() },
        { id: 'sub-002', problemId: 'prob-002', problemTitle: '최단 경로', language: 'Java', sagaStep: 'AI_QUEUED', createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString() },
        { id: 'sub-003', problemId: 'prob-003', problemTitle: '이분 탐색', language: 'Python', sagaStep: 'DONE', createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() },
      ];
      setMembers(mockMembers);
      setStats(mockStats);
      setActiveProblems(mockActiveProblems);
      setAllProblems(mockAllProblems);
      setRecentSubmissions(mockSubmissions);
      setIsLoading(false);
      return;
    }

    // ──────────────────────────────────────────────────────────────

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

        {/* ── STAT CARDS + STUDY ROOM (4열) ── */}
        {currentStudyId && (
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-4" style={fade(0.08)}>
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
              label="알고리즘 마스터"
              value={statsLoading ? '' : members.length}
              loading={statsLoading}
              href={currentStudyId ? `/studies/${currentStudyId}` : undefined}
              animRef={memberRef}
              valueColor="text-primary"
            />
            <StatCard
              icon={BarChart3}
              label="통계"
              value={statsLoading ? '' : `${myCompletionPct}점`}
              loading={statsLoading}
              href="/analytics"
              animRef={completionRef}
              valueColor="text-primary"
            />
            {/* 스터디룸 카드 - 그라데이션 보라 */}
            <Link href={currentStudyId ? `/studies/${currentStudyId}/room` : '/study-room'}>
              <Card className="group cursor-pointer p-5 text-white transition-all hover:brightness-105" style={{ ...fade(0.08), background: 'var(--gradient-brand)' }}>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-white/20">
                    <MessageCircle className="h-4 w-4 text-white" aria-hidden />
                  </div>
                  <div>
                    <p className="font-mono text-[28px] font-bold leading-none tracking-tight text-white">스터디룸</p>
                    <p className="mt-1 text-[11px] text-white/70">입장하기</p>
                  </div>
                </div>
              </Card>
            </Link>
          </div>
        )}

        {/* ── WEEKLY CHART (dynamic) ── */}
        {/* ── MIDDLE ROW: 주차별 차트(좌) + 진행 중인 문제(우) ── */}
        {currentStudyId && (
          <div className="grid gap-3.5 md:grid-cols-[3fr_2fr]" style={fade(0.16)}>
            {/* 주차별 제출 현황 차트 */}
            {stats && stats.byWeek.length > 0 ? (
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

