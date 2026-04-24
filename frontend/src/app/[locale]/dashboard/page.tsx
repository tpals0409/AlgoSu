/**
 * @file Dashboard 페이지 (v2 전면 교체 + dynamic import 최적화)
 * @domain dashboard
 * @layer page
 * @related AppLayout, AuthContext, StudyContext, useRequireAuth, useAnimVal
 */

'use client';

import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import dynamic from 'next/dynamic';
import {
  FileText,
  Users,
  BarChart3,
  Github,
  MessageCircle,
  X,
  RefreshCw,
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
import { useStudyStats } from '@/hooks/use-study-stats';
import { useSubmissions } from '@/hooks/use-submissions';
import { useProblems } from '@/hooks/use-problems';
import { useStudyMembers } from '@/hooks/use-study-members';
import { cn, getCurrentWeekLabel } from '@/lib/utils';
import { parseWeekKey } from '@/lib/util/parseWeekKey';
import { EmptyState } from '@/components/ui/EmptyState';
import { AdBanner } from '@/components/ad/AdBanner';
import { AD_SLOTS } from '@/lib/constants/adSlots';

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
  readonly value: ReactNode;
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
  const t = useTranslations('dashboard');
  const router = useRouter();
  const { isReady } = useRequireAuth();
  const { isStudyReady } = useRequireStudy();
  const { isAuthenticated, githubConnected, user } = useAuth();
  const { currentStudyId, currentStudyName, studiesLoaded, problemsVersion } = useStudy();

  // SWR 훅 — 각 섹션별 독립 로딩/에러 추적
  // Sprint 126 Wave C P2#1 fix: auth/study 가드 결합 — isLoading 기간 동안 보호 API 호출 차단
  const fetchableStudyId =
    isAuthenticated && studiesLoaded ? currentStudyId : null;
  const weekLabel = useMemo(() => getCurrentWeekLabel(), []);
  const {
    stats,
    isLoading: statsHookLoading,
    error: statsError,
    mutate: mutateStats,
  } = useStudyStats(fetchableStudyId, weekLabel);
  const {
    submissions: recentSubmissions,
    isLoading: submissionsHookLoading,
    error: submissionsError,
    mutate: mutateSubmissions,
  } = useSubmissions(fetchableStudyId, { page: 1, limit: 5 });
  const {
    problems: allProblems,
    isLoading: problemsHookLoading,
    error: problemsError,
    mutate: mutateProblems,
  } = useProblems(fetchableStudyId);
  const {
    members,
    isLoading: membersHookLoading,
    error: membersError,
    mutate: mutateMembers,
  } = useStudyMembers(fetchableStudyId);

  const activeProblems = allProblems;

  const [mounted, setMounted] = useState(false);
  const [weekViewUserId, setWeekViewUserId] = useState<string | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setBannerDismissed(sessionStorage.getItem('algosu:github-banner-dismissed') === 'true');
    }
  }, []);

  useEffect(() => {
    const mountTimer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(mountTimer);
  }, []);

  // ─── DATA REFRESH ────────────────────────

  /**
   * 모든 섹션을 동시에 재검증 (전역 retry 버튼)
   */
  const reloadAll = useCallback(() => {
    mutateStats();
    mutateSubmissions();
    mutateProblems();
    mutateMembers();
  }, [mutateStats, mutateSubmissions, mutateProblems, mutateMembers]);

  // 문제 등록/삭제 시 problemsVersion 변경 → 문제·통계 무효화
  useEffect(() => {
    if (isAuthenticated && studiesLoaded && currentStudyId && problemsVersion > 0) {
      mutateProblems();
      mutateStats();
    }
  }, [problemsVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── ERROR LABELS ────────────────────────

  const sectionErrors = useMemo(() => ({
    stats: statsError ? t('errors.stats') : null,
    submissions: submissionsError ? t('errors.submissions') : null,
    problems: problemsError ? t('errors.problems') : null,
    members: membersError ? t('errors.members') : null,
  }), [statsError, submissionsError, problemsError, membersError, t]);

  const [globalErrorDismissed, setGlobalErrorDismissed] = useState(false);
  const allFailed =
    !!statsError && !!submissionsError && !!problemsError && !!membersError;
  const error = !globalErrorDismissed && allFailed ? t('errors.loadFailed') : null;

  // 에러 상태 변화 시 dismiss 플래그 리셋
  useEffect(() => {
    if (allFailed) setGlobalErrorDismissed(false);
  }, [allFailed]);

  const isLoading =
    statsHookLoading || submissionsHookLoading || problemsHookLoading || membersHookLoading;

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




  // 내 제출 통계 — 백엔드 byMember 집계 사용 (recentSubmissions limit 무관)
  const myStats = useMemo(() => {
    if (!stats || !myUserId) return { count: 0, doneCount: 0 };
    const me = stats.byMember.find((m) => m.userId === myUserId);
    if (!me) return { count: 0, doneCount: 0 };
    return { count: me.uniqueProblemCount, doneCount: me.uniqueDoneCount };
  }, [stats, myUserId]);

  const myUniqueProblemCount = useMemo(() => {
    if (!stats || !myUserId) return 0;
    const me = stats.byMember.find((m) => m.userId === myUserId);
    return me?.uniqueDoneCount ?? 0;
  }, [stats, myUserId]);

  // AI 코드분석 평균 점수 (유저 전체 제출에서 문제별 최고 점수 기준, 같은 문제 1회)
  const myAvgAIScore = useMemo(() => {
    if (!stats) return 0;
    const bestByProblem = new Map<string, number>();
    for (const s of stats.userSubmissions ?? []) {
      if (s.aiScore == null) continue;
      const prev = bestByProblem.get(s.problemId) ?? 0;
      if (s.aiScore > prev) bestByProblem.set(s.problemId, s.aiScore);
    }
    const scores = Array.from(bestByProblem.values());
    return scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  }, [stats]);

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

  const filteredByWeek = useMemo(() => {
    if (!stats) return [];

    // problemId → weekNumber 매핑
    const problemWeekMap = new Map<string, string>();
    for (const p of allProblems) problemWeekMap.set(p.id, p.weekNumber);

    // byWeekPerUser가 있으면 사용, 없으면 userSubmissions에서 도출
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
      // userSubmissions → 주차별 고유 문제 수 (활성 문제만, fallback)
      const weekProblemMap = new Map<string, Set<string>>();
      for (const s of stats.userSubmissions ?? []) {
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
  }, [stats, weekViewUserId, allProblems, activeProblemIds]);

  const getViewLabel = useCallback((userId: string | null) => {
    if (userId === null) return t('weekView.all');
    if (userId === myUserId) return t('weekView.mySubmissions');
    const member = members.find((m) => m.user_id === userId);
    return member?.nickname ?? member?.username ?? member?.email?.split('@')[0] ?? userId.slice(0, 8);
  }, [members, myUserId, t]);

  const weekViewLabel = useMemo(() => getViewLabel(weekViewUserId), [weekViewUserId, getViewLabel]);

  // Sprint 126 Wave C P2#2 fix: 전역 error가 아닌 statsError로 게이팅 (stats만 실패 시 영구 true 방지)
  const statsLoading = statsHookLoading || (currentStudyId != null && stats === null && !statsError);

  // animated counters (ref만 StatCard에 전달)
  const [submissionRef] = useAnimVal(myStats.count);
  const [memberRef] = useAnimVal(members.length);
  const [completionRef] = useAnimVal(myCompletionPct);

  // ─── LOADING SCREEN ───────────────────────

  if (!isReady || !isStudyReady) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg">
        <LoadingSpinner size="lg" color="primary" />
        <p className="text-sm text-text-3">{t('loading')}</p>
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
                return displayName ? t('greeting.hello', { name: displayName }) : t('greeting.helloDefault');
              })()}
            </h1>
            <p className="mt-0.5 text-xs text-text-3">
              {t('greeting.sub')}
            </p>
          </div>
        </div>

        {error && (
          <Alert variant="error" onClose={() => setGlobalErrorDismissed(true)}>
            {error}
            <Button variant="ghost" size="sm" className="ml-2 h-auto px-2 py-0.5 text-inherit" onClick={reloadAll}>
              <RefreshCw className="mr-1 h-3 w-3" aria-hidden />
              {t('retry')}
            </Button>
          </Alert>
        )}

        {/* ── NO STUDY GUIDE ── */}
        {!currentStudyId && !isLoading && (
          <EmptyState
            icon={Users}
            title={t('empty.noStudy')}
            description={t('empty.noStudyDesc')}
            action={{
              label: t('empty.browseStudies'),
              onClick: () => router.push('/studies'),
              variant: 'primary',
            }}
          />
        )}

        {/* ── GITHUB ONBOARDING BANNER ── */}
        {!githubConnected && !isLoading && !bannerDismissed && (
          <Card className="border-warning/30 bg-warning-soft" style={fade(0.06)}>
            <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Github className="h-5 w-5 shrink-0 text-warning" aria-hidden />
                <div>
                  <p className="text-[13px] font-medium text-text">{t('cta.github')}</p>
                  <p className="text-[11px] text-text-3">{t('cta.githubDesc')}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => router.push('/github-link')}>
                  {t('cta.githubLink')}
                </Button>
                <button
                  type="button"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-text-3 transition-colors hover:bg-bg-alt hover:text-text"
                  aria-label={t('cta.closeBanner')}
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
            <Button
              variant="ghost"
              size="sm"
              className="ml-2 h-auto px-2 py-0.5 text-inherit"
              onClick={() => {
                if (sectionErrors.stats) mutateStats();
                if (sectionErrors.members) mutateMembers();
              }}
            >
              <RefreshCw className="mr-1 h-3 w-3" aria-hidden />
              {t('retry')}
            </Button>
          </Alert>
        )}

        {/* ── STAT CARDS + STUDY ROOM (4열) ── */}
        {currentStudyId && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3.5 lg:grid-cols-4" style={fade(0.08)}>
            <StatCard
              icon={FileText}
              label={t('stats.submissions')}
              value={statsLoading ? '' : myStats.count}
              loading={statsLoading}
              href="/submissions"
              animRef={submissionRef}
            />
            <StatCard
              icon={Users}
              label={currentStudyName ?? t('stats.study')}
              value={statsLoading ? '' : members.length}
              loading={statsLoading}
              href={currentStudyId ? `/studies/${currentStudyId}` : undefined}
              animRef={memberRef}
              valueColor="text-primary"
            />
            <StatCard
              icon={BarChart3}
              label={t('stats.analytics')}
              value={statsLoading ? '' : <>{myAvgAIScore}<span className="font-sans">{t('stats.scoreUnit')}</span></>}
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
                    <p className="whitespace-nowrap text-xl sm:text-[28px] font-bold leading-none tracking-tight text-white">{t('studyRoom.title')}</p>
                    <p className="mt-1 whitespace-nowrap text-xs font-medium text-white/70">{t('studyRoom.enter')}</p>
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
            <Button variant="ghost" size="sm" className="ml-2 h-auto px-2 py-0.5 text-inherit" onClick={mutateProblems}>
              <RefreshCw className="mr-1 h-3 w-3" aria-hidden />
              {t('retry')}
            </Button>
          </Alert>
        )}

        {/* ── WEEKLY CHART (dynamic) ── */}
        {/* ── MIDDLE ROW: 주차별 차트(좌) + 진행 중인 문제(우) ── */}
        {currentStudyId && (
          <div className="grid gap-3.5 md:grid-cols-2" style={fade(0.16)}>
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
                <p className="text-sm text-text-3">{t('empty.noData')}</p>
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
            <Button variant="ghost" size="sm" className="ml-2 h-auto px-2 py-0.5 text-inherit" onClick={mutateSubmissions}>
              <RefreshCw className="mr-1 h-3 w-3" aria-hidden />
              {t('retry')}
            </Button>
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

        {/* ── AD ── */}
        <AdBanner slot={AD_SLOTS.DASHBOARD_BOTTOM} />
      </div>
    </AppLayout>
  );
}

