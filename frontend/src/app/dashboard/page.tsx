/**
 * @file Dashboard 페이지 (v2 전면 교체)
 * @domain dashboard
 * @layer page
 * @related AppLayout, AuthContext, StudyContext, useRequireAuth, useAnimVal
 */

'use client';

import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  FileText,
  Users,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  Clock,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useStudy } from '@/contexts/StudyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRequireAuth } from '@/hooks/useRequireAuth';
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
import { SAGA_STEP_CONFIG, type SagaStep } from '@/lib/constants';
import { cn, getCurrentWeekLabel } from '@/lib/utils';
import { getCurrentUserId } from '@/lib/auth';

// ─── HELPERS ─────────────────────────────

/** 날짜 포맷: MM.DD HH:MM */
function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${month}.${day} ${hours}:${minutes}`;
}

// ─── STAT CARD ───────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  loading,
  href,
  animRef,
}: {
  readonly icon: typeof FileText;
  readonly label: string;
  readonly value: string | number;
  readonly loading: boolean;
  readonly href?: string;
  readonly animRef?: React.RefObject<HTMLDivElement | null>;
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
          <p className="font-mono text-[28px] font-bold leading-none tracking-tight text-text">
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

// ─── WEEKLY BAR ──────────────────────────

function WeeklyBar({
  label,
  value,
  max,
  mounted,
  delay,
}: {
  readonly label: string;
  readonly value: number;
  readonly max: number;
  readonly mounted: boolean;
  readonly delay: number;
}): ReactNode {
  const pct = max > 0 ? Math.min(Math.round((value / max) * 100), 100) : 0;

  return (
    <div className="flex items-center gap-3">
      <span className="min-w-[56px] text-right font-mono text-xs text-text-2">
        {label}
      </span>
      <div
        className="h-[22px] flex-1 overflow-hidden rounded-badge"
        style={{ background: 'var(--bar-track)' }}
      >
        <div
          className="h-full rounded-badge transition-all duration-700 ease-bounce"
          style={{
            width: mounted ? `${pct}%` : '0%',
            background: 'var(--bar-fill)',
            transitionDelay: `${delay}s`,
          }}
        />
      </div>
      <span className="min-w-[28px] font-mono text-[13px] font-semibold">
        {value}
      </span>
    </div>
  );
}

// ─── RENDER ──────────────────────────────

export default function DashboardPage(): ReactNode {
  const router = useRouter();
  const { isReady } = useRequireAuth();
  const { isAuthenticated } = useAuth();
  const { user } = useAuth();
  const { currentStudyId, currentStudyName, studies, studiesLoaded } = useStudy();

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
    if (isAuthenticated && studiesLoaded) {
      void loadDashboard();
    }
  }, [isAuthenticated, studiesLoaded, loadDashboard]);

  // ─── DERIVED STATE ────────────────────────

  const problemTitleMap = useMemo(() => {
    return new Map(allProblems.map((p) => [p.id, p.title]));
  }, [allProblems]);

  const submittedProblemIds = useMemo(() => {
    return new Set(recentSubmissions.map((s) => s.problemId));
  }, [recentSubmissions]);

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
    const userId = getCurrentUserId();
    if (!stats?.byMember.length || !userId) return { count: 0, doneCount: 0 };
    const me = stats.byMember.find((m) => m.userId === userId);
    return me ? { count: me.count, doneCount: me.doneCount } : { count: 0, doneCount: 0 };
  }, [stats]);

  const myUniqueProblemCount = useMemo(() => {
    const userId = getCurrentUserId();
    if (!stats?.byWeekPerUser.length || !userId) return 0;
    return stats.byWeekPerUser
      .filter((r) => r.userId === userId)
      .reduce((sum, r) => sum + r.count, 0);
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
    const myId = getCurrentUserId();
    const otherIds = members.filter((m) => m.user_id !== myId).map((m) => m.user_id);
    return [null, myId, ...otherIds] as (string | null)[];
  }, [members]);

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
    const myId = getCurrentUserId();
    if (userId === myId) return '내 풀이';
    const member = members.find((m) => m.user_id === userId);
    return member?.username ?? member?.email?.split('@')[0] ?? userId.slice(0, 8);
  }, [members]);

  const weekViewLabel = useMemo(() => getViewLabel(weekViewUserId), [weekViewUserId, getViewLabel]);

  const statsLoading = isLoading || (currentStudyId != null && stats === null && !error);

  // animated counters (ref만 StatCard에 전달)
  const [submissionRef] = useAnimVal(myStats.count);
  const [memberRef] = useAnimVal(members.length);
  const [completionRef] = useAnimVal(myCompletionPct);

  // ─── LOADING SCREEN ───────────────────────

  if (!isReady) {
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
            <h1 className="text-[22px] font-bold tracking-tight">대시보드</h1>
            <p className="mt-0.5 text-xs text-text-3">
              {user?.email ? `${user.email}님, 안녕하세요!` : '환영합니다'}
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

        {/* ── EMPTY STATE (스터디 미선택) ── */}
        {!currentStudyId && !isLoading && (
          <Card className="p-8">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-bg-alt">
                <Users className="h-5 w-5 text-primary" aria-hidden />
              </div>
              <div>
                <p className="text-sm font-medium">
                  아직 참여 중인 스터디가 없습니다
                </p>
                <p className="mt-1 text-[11px] text-text-3">
                  스터디를 만들거나 초대코드로 참여해보세요.
                </p>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => router.push('/studies/create')}
                >
                  스터디 생성
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push('/studies')}
                >
                  초대코드 입력
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* ── STUDY CARD GRID ── */}
        {studies.length > 0 && !currentStudyId && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" style={fade(0.08)}>
            {studies.map((study) => (
              <Card
                key={study.id}
                className="cursor-pointer p-5 transition-all hover:border-primary"
                onClick={() => router.push(`/studies/${study.id}`)}
              >
                <h3 className="mb-1 text-sm font-semibold">{study.name}</h3>
                <div className="flex items-center gap-2 text-[11px] text-text-3">
                  <Badge variant={study.role === 'ADMIN' ? 'default' : 'muted'}>
                    {study.role === 'ADMIN' ? '관리자' : '멤버'}
                  </Badge>
                  <span>{study.memberCount ?? 0}명</span>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* ── STAT CARDS ── */}
        {currentStudyId && (
          <div className="grid grid-cols-3 gap-3.5" style={fade(0.08)}>
            <StatCard
              icon={FileText}
              label="내 제출 (이번 스터디 전체)"
              value={statsLoading ? '' : myStats.count}
              loading={statsLoading}
              href="/submissions"
              animRef={submissionRef}
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
            />
          </div>
        )}

        {/* ── WEEKLY CHART ── */}
        {currentStudyId && stats && stats.byWeek.length > 0 && (
          <Card
            className="group cursor-pointer"
            onClick={cycleWeekView}
            style={fade(0.16)}
          >
            <CardHeader className="flex flex-row items-center gap-2.5">
              <CardTitle>주차별 제출 현황</CardTitle>
              <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft2 px-2.5 py-1 text-[11px] font-medium text-primary">
                <span
                  className="inline-block h-[5px] w-[5px] shrink-0 rounded-full gradient-brand"
                  aria-hidden
                />
                {weekViewLabel}
              </span>
              <span className="text-[10px] text-text-3 opacity-0 transition-opacity group-hover:opacity-100">
                클릭하여 전환
              </span>
            </CardHeader>
            <CardContent>
              {filteredByWeek.length === 0 ? (
                <p className="py-4 text-center text-sm text-text-3">
                  제출 기록이 없습니다.
                </p>
              ) : (
                <div key={weekViewLabel} className="space-y-2.5 animate-fade-in">
                  {filteredByWeek.slice(0, 5).map((w, i) => {
                    const pc = problemCountByWeek.get(w.week) ?? 0;
                    const total = weekViewUserId === null ? pc * members.length : pc;
                    return (
                      <WeeklyBar
                        key={w.week}
                        label={w.week}
                        value={w.count}
                        max={total}
                        mounted={mounted}
                        delay={0.3 + i * 0.1}
                      />
                    );
                  })}
                  {filteredByWeek.length > 5 && (
                    <Link
                      href="/analytics"
                      onClick={(e) => e.stopPropagation()}
                      className="block pt-1 text-center text-[11px] font-medium text-primary hover:underline"
                    >
                      전체 {filteredByWeek.length}주 보기 →
                    </Link>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── TWO COLUMN GRID ── */}
        <div className="grid gap-3.5 md:grid-cols-2" style={fade(0.24)}>
          {/* 최근 제출 5건 */}
          <Card className="overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-sm font-semibold">최근 제출</h2>
              <Link
                href="/submissions"
                className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
              >
                전체 보기
                <ArrowRight className="h-3 w-3" aria-hidden />
              </Link>
            </div>
            {isLoading ? (
              <div className="space-y-3 p-5">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} height={36} />
                ))}
              </div>
            ) : recentSubmissions.length === 0 ? (
              <p className="py-8 text-center text-sm text-text-3">
                아직 제출 내역이 없습니다
              </p>
            ) : (
              <div>
                {recentSubmissions.map((s, i) => (
                  <Link
                    key={s.id}
                    href={
                      s.sagaStep === 'DONE'
                        ? `/submissions/${s.id}/analysis`
                        : `/problems/${s.problemId}`
                    }
                    className={cn(
                      'group flex items-center justify-between px-5 py-3.5 transition-all hover:bg-primary-soft',
                      i < recentSubmissions.length - 1 && 'border-b border-border',
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium transition-colors group-hover:text-primary">
                        {s.problemTitle ?? problemTitleMap.get(s.problemId) ?? `문제 ${s.problemId.slice(0, 8)}`}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-text-3">
                        <span>{s.language}</span>
                        <span className="mx-1.5 opacity-30">·</span>
                        <span>{formatDate(s.createdAt)}</span>
                      </p>
                    </div>
                    <Badge
                      variant={SAGA_STEP_CONFIG[s.sagaStep as SagaStep]?.variant ?? 'muted'}
                      dot
                    >
                      {SAGA_STEP_CONFIG[s.sagaStep as SagaStep]?.label ?? s.sagaStep}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          {/* 마감 임박 문제 */}
          <Card className="overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-sm font-semibold">마감 임박 문제</h2>
              <Link
                href="/problems"
                className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
              >
                전체 보기
                <ArrowRight className="h-3 w-3" aria-hidden />
              </Link>
            </div>
            {isLoading ? (
              <div className="space-y-3 p-5">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} height={36} />
                ))}
              </div>
            ) : upcomingDeadlines.length === 0 ? (
              <p className="py-8 text-center text-sm text-text-3">
                마감 예정인 문제가 없습니다
              </p>
            ) : (
              <div>
                {upcomingDeadlines.map((p, i) => {
                  const deadlineDate = new Date(p.deadline);
                  const now = new Date();
                  const diffMs = deadlineDate.getTime() - now.getTime();
                  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                  const isUrgent = diffHours < 24;
                  const isSubmitted = submittedProblemIds.has(p.id);

                  return (
                    <Link
                      key={p.id}
                      href={`/problems/${p.id}`}
                      className={cn(
                        'group flex items-center justify-between px-5 py-3.5 transition-all hover:bg-primary-soft',
                        i < upcomingDeadlines.length - 1 && 'border-b border-border',
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          {isSubmitted && (
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" aria-hidden />
                          )}
                          <p className={cn(
                            'truncate text-[13px] font-medium transition-colors',
                            isSubmitted ? 'text-text-3' : 'group-hover:text-primary',
                          )}>
                            {p.title}
                          </p>
                        </div>
                        <p className="mt-0.5 font-mono text-[10px] text-text-3">
                          {p.weekNumber}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {isSubmitted && (
                          <Badge variant="success">제출 완료</Badge>
                        )}
                        <span className={cn(
                          'flex items-center gap-1 font-mono text-[11px] whitespace-nowrap',
                          isUrgent ? 'font-medium text-error animate-pulse-dot' : 'text-text-3',
                        )}>
                          <Clock className="h-3 w-3" aria-hidden />
                          {diffDays > 0
                            ? `${diffDays}일 남음`
                            : diffHours > 0
                              ? `${diffHours}시간 남음`
                              : '곧 마감'}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
