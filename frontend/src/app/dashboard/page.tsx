'use client';

import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  BarChart3,
  FileText,
  Users,
  Clock,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useStudy } from '@/contexts/StudyContext';
import { useRequireAuth } from '@/hooks/useRequireAuth';
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
import { cn } from '@/lib/utils';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${month}.${day} ${hours}:${minutes}`;
}

/** D-01: 멤버 이름 표시 fallback 체인 */
function getMemberDisplayName(
  userId: string,
  memberMap: Map<string, StudyMember>,
): string {
  const member = memberMap.get(userId);
  if (member?.username) return member.username;
  if (member?.email) return member.email.split('@')[0];
  return userId.slice(0, 8);
}

/** D-01: 아바타 이니셜 */
function getInitials(
  userId: string,
  memberMap: Map<string, StudyMember>,
): string {
  const member = memberMap.get(userId);
  const name = member?.username ?? member?.email ?? userId;
  // 한글이면 첫 1자, 영문이면 첫 2자
  const firstChar = name.charAt(0);
  if (/[\uAC00-\uD7A3]/.test(firstChar)) return firstChar;
  return name.slice(0, 2).toUpperCase();
}

function StatCard({
  icon: Icon,
  label,
  value,
  loading,
}: {
  readonly icon: typeof BarChart3;
  readonly label: string;
  readonly value: string | number;
  readonly loading: boolean;
}): ReactNode {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-3">
        <div
          className="flex items-center justify-center rounded-md bg-bg2"
          style={{ width: '36px', height: '36px' }}
        >
          <Icon className="h-4 w-4 text-primary" aria-hidden />
        </div>
        <div>
          {loading ? (
            <Skeleton height={20} width={60} />
          ) : (
            <p className="text-lg font-bold text-foreground">{value}</p>
          )}
          <p className="font-mono text-[10px] text-muted-foreground">{label}</p>
        </div>
      </div>
    </Card>
  );
}

function WeeklyBar({
  data,
  maxCount,
}: {
  readonly data: { week: string; count: number };
  readonly maxCount: number;
}): ReactNode {
  const pct = maxCount > 0 ? Math.round((data.count / maxCount) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 text-right font-mono text-[10px] text-muted-foreground truncate">
        {data.week}
      </span>
      <div className="flex-1 h-5 bg-bg2 rounded-sm overflow-hidden">
        {/* D-06: 툴팁으로 상세 표시 */}
        <div
          className="h-full rounded-sm gradient-brand transition-all duration-300"
          style={{ width: `${pct}%` }}
          title={`${data.week}: ${data.count}건 (${pct}%)`}
        />
      </div>
      <span className="w-8 text-right font-mono text-[11px] text-foreground">
        {data.count}
      </span>
    </div>
  );
}

export default function DashboardPage(): ReactNode {
  const router = useRouter();
  const { isReady, isAuthenticated } = useRequireAuth();
  const { currentStudyId, currentStudyName } = useStudy();

  const [stats, setStats] = useState<StudyStats | null>(null);
  // D-01: memberCount → members 배열로 변경 (프론트 조인용)
  const [members, setMembers] = useState<StudyMember[]>([]);
  const [recentSubmissions, setRecentSubmissions] = useState<Submission[]>([]);
  const [activeProblems, setActiveProblems] = useState<Problem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const results = await Promise.allSettled([
        currentStudyId ? studyApi.getStats(currentStudyId) : Promise.resolve(null),
        submissionApi.list({ page: 1, limit: 5 }),
        problemApi.findAll(),
        currentStudyId ? studyApi.getMembers(currentStudyId) : Promise.resolve([]),
      ]);

      // 스터디 통계
      if (results[0].status === 'fulfilled' && results[0].value) {
        setStats(results[0].value as StudyStats);
      } else {
        setStats(null);
      }

      // 최근 제출
      if (results[1].status === 'fulfilled') {
        const paginated = results[1].value as { data: Submission[]; meta: unknown };
        setRecentSubmissions(paginated.data ?? []);
      }

      // 활성 문제
      if (results[2].status === 'fulfilled') {
        setActiveProblems((results[2].value as Problem[]) ?? []);
      }

      // D-01: 멤버 배열 전체 저장
      if (results[3].status === 'fulfilled') {
        setMembers((results[3].value as StudyMember[]) ?? []);
      }

      // 전부 실패한 경우에만 에러 표시
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
    if (isAuthenticated) {
      void loadDashboard();
    }
  }, [isAuthenticated, loadDashboard]);

  // D-01: userId → StudyMember 매핑
  const memberMap = useMemo(() => {
    const map = new Map<string, StudyMember>();
    for (const m of members) {
      map.set(m.user_id, m);
    }
    return map;
  }, [members]);

  // D-04: 제출 완료된 문제 ID 집합
  const submittedProblemIds = useMemo(() => {
    return new Set(recentSubmissions.map((s) => s.problemId));
  }, [recentSubmissions]);

  // 마감 임박 문제 (ACTIVE + 마감일 있는 것만, 마감일 순 정렬)
  const upcomingDeadlines = useMemo(() => {
    const now = new Date();
    return activeProblems
      .filter(
        (p) => p.status === 'ACTIVE' && p.deadline && new Date(p.deadline) > now,
      )
      .sort(
        (a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime(),
      )
      .slice(0, 5);
  }, [activeProblems]);

  const maxWeekCount = useMemo(() => {
    if (!stats?.byWeek.length) return 0;
    return Math.max(...stats.byWeek.map((w) => w.count));
  }, [stats]);

  // D-10: 멤버별 현황 정렬 (제출 수 내림차순)
  const sortedMembers = useMemo(() => {
    if (!stats?.byMember.length) return [];
    return [...stats.byMember].sort((a, b) => b.count - a.count);
  }, [stats]);

  // D-09: 통계 로딩 판단 (isLoading 또는 stats가 아직 null)
  const statsLoading = isLoading || (currentStudyId != null && stats === null && !error);

  if (!isReady) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background">
        <LoadingSpinner size="lg" color="primary" />
        <p className="text-sm text-muted-foreground">로딩 중...</p>
      </div>
    )
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* D-08: 헤더 + 새로고침 버튼 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-foreground">
              {currentStudyName ? `${currentStudyName} \u00B7 대시보드` : '대시보드'}
            </h1>
            <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
              {currentStudyId ? '스터디 현황 요약' : '스터디를 선택하면 통계를 볼 수 있습니다'}
            </p>
          </div>
          {currentStudyId && (
            <button
              type="button"
              className="flex items-center justify-center rounded-btn bg-bg2 text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
              style={{ width: '28px', height: '28px' }}
              onClick={() => void loadDashboard()}
              disabled={isLoading}
              aria-label="대시보드 새로고침"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
            </button>
          )}
        </div>

        {error && (
          <Alert variant="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* 스터디 미선택 시 온보딩 (C2) */}
        {!currentStudyId && !isLoading && (
          <Card className="p-8">
            <div className="flex flex-col items-center text-center gap-4">
              <div
                className="flex items-center justify-center rounded-full bg-bg2"
                style={{ width: '48px', height: '48px' }}
              >
                <Users className="h-5 w-5 text-primary" aria-hidden />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">스터디에 참여해보세요</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  스터디를 만들거나 초대 코드로 참여하면 대시보드를 확인할 수 있습니다.
                </p>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => router.push('/studies/create')}
                >
                  스터디 만들기
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push('/studies')}
                >
                  스터디 둘러보기
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* 통계 카드들 */}
        {currentStudyId && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard
              icon={FileText}
              label="총 제출"
              value={stats?.totalSubmissions ?? 0}
              loading={statsLoading}
            />
            <StatCard
              icon={Users}
              label="참여 멤버"
              value={members.length}
              loading={statsLoading}
            />
            {/* D-10: "진행 주차" → "완료 주차" 명확화 */}
            <StatCard
              icon={BarChart3}
              label="완료 주차"
              value={stats?.byWeek.length ?? 0}
              loading={statsLoading}
            />
          </div>
        )}

        {/* D-07: 주차별 제출률 차트 (max-height + 스크롤) */}
        {currentStudyId && stats && stats.byWeek.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>주차별 제출 현황</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-[280px] overflow-y-auto space-y-2">
                {stats.byWeek.map((w) => (
                  <WeeklyBar key={w.week} data={w} maxCount={maxWeekCount} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* D-01 + D-11: 멤버별 현황 (이름 표시 + 완료율 바 + 정렬) */}
        {currentStudyId && sortedMembers.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>멤버별 현황</CardTitle>
              <Link
                href={`/studies/${currentStudyId}`}
                className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
              >
                상세 보기
                <ArrowRight className="h-3 w-3" aria-hidden />
              </Link>
            </CardHeader>
            <CardContent>
              <div className="max-h-[320px] overflow-y-auto space-y-2">
                {sortedMembers.map((m) => {
                  const displayName = getMemberDisplayName(m.userId, memberMap);
                  const initials = getInitials(m.userId, memberMap);
                  const completionPct = m.count > 0
                    ? Math.round((m.doneCount / m.count) * 100)
                    : 0;

                  return (
                    <div
                      key={m.userId}
                      className="flex items-center justify-between py-1.5"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div
                          className="flex shrink-0 items-center justify-center rounded-full text-white"
                          style={{
                            width: '24px',
                            height: '24px',
                            background: 'linear-gradient(135deg, var(--color-main), var(--color-sub))',
                            fontSize: '9px',
                            fontWeight: 600,
                          }}
                        >
                          {initials}
                        </div>
                        <span className="font-mono text-[11px] text-foreground truncate">
                          {displayName}
                        </span>
                        {/* D-11: 완료율 미니바 */}
                        <div
                          className="hidden sm:block bg-bg2 rounded-full overflow-hidden"
                          style={{ width: '48px', height: '4px' }}
                          title={`완료율 ${completionPct}%`}
                        >
                          <div
                            className="h-full rounded-full gradient-brand"
                            style={{ width: `${completionPct}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {m.count}건 제출
                        </span>
                        <span className="font-mono text-[11px] text-success">
                          {m.doneCount}건 완료
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {/* D-02: 최근 제출 (클릭 가능) */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>최근 제출</CardTitle>
              <Link
                href="/submissions"
                className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
              >
                전체 보기
                <ArrowRight className="h-3 w-3" aria-hidden />
              </Link>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} height={36} />
                  ))}
                </div>
              ) : recentSubmissions.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  아직 제출 기록이 없습니다.
                </p>
              ) : (
                <div className="space-y-2">
                  {recentSubmissions.map((s) => (
                    <Link
                      key={s.id}
                      href={
                        s.sagaStep === 'DONE'
                          ? `/submissions/${s.id}/analysis`
                          : `/problems/${s.problemId}`
                      }
                      className="flex items-center justify-between rounded-sm px-2 py-1.5 hover:bg-muted/40 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-medium text-foreground truncate">
                          {s.problemTitle ?? `문제 ${s.problemId.slice(0, 8)}`}
                        </p>
                        <p className="font-mono text-[10px] text-muted-foreground">
                          {formatDate(s.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        <Badge variant="info">{s.language}</Badge>
                        <Badge variant={SAGA_STEP_CONFIG[s.sagaStep as SagaStep]?.variant ?? 'muted'} dot>
                          {SAGA_STEP_CONFIG[s.sagaStep as SagaStep]?.label ?? s.sagaStep}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* D-04 + D-05: 마감 임박 문제 (제출 완료 표시 + 주차 포맷) */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>마감 임박</CardTitle>
              <Link
                href="/problems"
                className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
              >
                전체 보기
                <ArrowRight className="h-3 w-3" aria-hidden />
              </Link>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} height={36} />
                  ))}
                </div>
              ) : upcomingDeadlines.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  마감 예정인 문제가 없습니다.
                </p>
              ) : (
                <div className="space-y-2">
                  {upcomingDeadlines.map((p) => {
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
                        className="flex items-center justify-between rounded-sm px-2 py-1.5 hover:bg-muted/40 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            {/* D-04: 제출 완료 표시 */}
                            {isSubmitted && (
                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" aria-hidden />
                            )}
                            <p className={cn(
                              'text-[12px] font-medium truncate',
                              isSubmitted ? 'text-muted-foreground' : 'text-foreground',
                            )}>
                              {p.title}
                            </p>
                          </div>
                          {/* D-05: weekNumber → "N주차" 포맷 */}
                          <p className="font-mono text-[10px] text-muted-foreground">
                            {p.weekNumber}주차
                          </p>
                        </div>
                        <div className="flex items-center gap-2 ml-2">
                          <Clock
                            className={`h-3 w-3 ${isUrgent ? 'text-error' : 'text-muted-foreground'}`}
                            aria-hidden
                          />
                          <span
                            className={`font-mono text-[11px] whitespace-nowrap ${
                              isUrgent ? 'text-error font-medium' : 'text-muted-foreground'
                            }`}
                          >
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
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
