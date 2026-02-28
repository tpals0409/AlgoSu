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
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useStudy } from '@/contexts/StudyContext';
import {
  studyApi,
  submissionApi,
  problemApi,
  type StudyStats,
  type Submission,
  type Problem,
} from '@/lib/api';

const SAGA_STEP_LABEL: Record<string, string> = {
  DB_SAVED: '저장됨',
  GITHUB_QUEUED: 'GitHub 대기',
  AI_QUEUED: 'AI 분석 대기',
  DONE: '완료',
  FAILED: '실패',
};

const SAGA_STEP_VARIANT: Record<string, 'success' | 'warning' | 'error' | 'info' | 'muted'> = {
  DB_SAVED: 'muted',
  GITHUB_QUEUED: 'info',
  AI_QUEUED: 'warning',
  DONE: 'success',
  FAILED: 'error',
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${month}.${day} ${hours}:${minutes}`;
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
  readonly data: { week: number; count: number };
  readonly maxCount: number;
}): ReactNode {
  const pct = maxCount > 0 ? Math.round((data.count / maxCount) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 text-right font-mono text-[10px] text-muted-foreground">
        {data.week}주차
      </span>
      <div className="flex-1 h-5 bg-bg2 rounded-sm overflow-hidden">
        <div
          className="h-full rounded-sm gradient-brand transition-all duration-300"
          style={{ width: `${pct}%` }}
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
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { currentStudyId } = useStudy();

  const [stats, setStats] = useState<StudyStats | null>(null);
  const [recentSubmissions, setRecentSubmissions] = useState<Submission[]>([]);
  const [activeProblems, setActiveProblems] = useState<Problem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const results = await Promise.allSettled([
        currentStudyId ? studyApi.getStats(currentStudyId) : Promise.resolve(null),
        submissionApi.list({ page: 1, limit: 5 }),
        problemApi.findAll(),
      ]);

      // 스터디 통계
      if (results[0].status === 'fulfilled' && results[0].value) {
        setStats(results[0].value as StudyStats);
      }

      // 최근 제출
      if (results[1].status === 'fulfilled') {
        const paginated = results[1].value as { items: Submission[] };
        setRecentSubmissions(paginated.items ?? []);
      }

      // 활성 문제
      if (results[2].status === 'fulfilled') {
        setActiveProblems((results[2].value as Problem[]) ?? []);
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

  if (authLoading) return null;
  if (!isAuthenticated) return null;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* 헤더 */}
        <div>
          <h1 className="text-base font-semibold text-foreground">대시보드</h1>
          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
            {currentStudyId ? '스터디 현황 요약' : '스터디를 선택하면 통계를 볼 수 있습니다'}
          </p>
        </div>

        {error && (
          <Alert variant="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* 스터디 미선택 시 안내 */}
        {!currentStudyId && !isLoading && (
          <EmptyState
            icon={BarChart3}
            title="스터디를 선택해주세요"
            description="상단 메뉴에서 스터디를 선택하면 대시보드를 확인할 수 있습니다."
            action={{ label: '스터디 목록', onClick: () => router.push('/studies') }}
          />
        )}

        {/* 통계 카드들 */}
        {currentStudyId && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard
              icon={FileText}
              label="총 제출"
              value={stats?.totalSubmissions ?? 0}
              loading={isLoading}
            />
            <StatCard
              icon={Users}
              label="참여 멤버"
              value={stats?.byMember.length ?? 0}
              loading={isLoading}
            />
            <StatCard
              icon={BarChart3}
              label="진행 주차"
              value={stats?.byWeek.length ?? 0}
              loading={isLoading}
            />
          </div>
        )}

        {/* 주차별 제출률 차트 */}
        {currentStudyId && stats && stats.byWeek.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>주차별 제출 현황</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {stats.byWeek.map((w) => (
                <WeeklyBar key={w.week} data={w} maxCount={maxWeekCount} />
              ))}
            </CardContent>
          </Card>
        )}

        {/* 멤버별 현황 */}
        {currentStudyId && stats && stats.byMember.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>멤버별 현황</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats.byMember.map((m) => (
                  <div
                    key={m.userId}
                    className="flex items-center justify-between py-1.5"
                  >
                    <div className="flex items-center gap-2">
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
                        {m.userId.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="font-mono text-[11px] text-foreground">
                        {m.userId.slice(0, 8)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {m.count}건 제출
                      </span>
                      <span className="font-mono text-[11px] text-success">
                        {m.doneCount}건 완료
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {/* 최근 제출 */}
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
                    <div
                      key={s.id}
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
                        <Badge variant={SAGA_STEP_VARIANT[s.sagaStep] ?? 'muted'} dot>
                          {SAGA_STEP_LABEL[s.sagaStep] ?? s.sagaStep}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 마감 임박 문제 */}
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

                    return (
                      <Link
                        key={p.id}
                        href={`/problems/${p.id}`}
                        className="flex items-center justify-between rounded-sm px-2 py-1.5 hover:bg-muted/40 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-[12px] font-medium text-foreground truncate">
                            {p.title}
                          </p>
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
