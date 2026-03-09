/**
 * @file 대시보드 2열 그리드 - 최근 제출 + 마감 임박 (dynamic import 대상)
 * @domain dashboard
 * @layer component
 * @related DashboardPage, DifficultyBadge, Badge
 */

'use client';

import { type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Clock } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { DifficultyBadge } from '@/components/ui/DifficultyBadge';
import { Skeleton } from '@/components/ui/Skeleton';
import type { Submission, Problem } from '@/lib/api';
import { DIFF_DOT_STYLE, DIFF_BADGE_STYLE, SAGA_STEP_CONFIG, type SagaStep, toTierLevel } from '@/lib/constants';
import type { Difficulty } from '@/lib/constants';
import { cn } from '@/lib/utils';


// ─── HELPERS ─────────────────────────────

/** 상대 시간 포맷: 방금 전, N분 전, N시간 전, N일 전 */
function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return '방금 전';
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  if (diffDay < 7) return `${diffDay}일 전`;

  const d = new Date(dateStr);
  return `${d.getMonth() + 1}.${d.getDate()}`;
}

// ─── TYPES ───────────────────────────────

export interface DashboardTwoColumnProps {
  readonly recentSubmissions: Submission[];
  readonly upcomingDeadlines: Problem[];
  readonly submittedProblemIds: Set<string>;
  readonly problemTitleMap: Map<string, string>;
  readonly allProblems: Problem[];
  readonly isLoading: boolean;
  readonly fadeStyle: React.CSSProperties;
}

// ─── COMPONENT ───────────────────────────

export default function DashboardTwoColumn({
  recentSubmissions,
  upcomingDeadlines,
  submittedProblemIds,
  problemTitleMap,
  allProblems,
  isLoading,
  fadeStyle,
}: DashboardTwoColumnProps): ReactNode {
  const problemMap = new Map(allProblems.map((p) => [p.id, p]));
  return (
    <div className={upcomingDeadlines.length > 0 ? "grid gap-3.5 md:grid-cols-2" : "block"} style={fadeStyle}>

      {/* 최근 제출 5건 */}
      <Card className="overflow-hidden p-0">
        <CardHeader className="flex flex-row items-center justify-between px-4 pb-2 pt-4">
          <CardTitle>최근 제출</CardTitle>
          <Link
            href="/submissions"
            className="flex items-center gap-0.5 text-[12px] font-medium text-text-3 transition-colors hover:text-primary"
          >
            전체 보기 <ArrowRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        {isLoading ? (
          <div className="space-y-3 p-4">
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
            {recentSubmissions.filter((s) => problemMap.has(s.problemId)).map((s) => (
              <Link
                key={s.id}
                href={
                  s.sagaStep === 'DONE'
                    ? `/submissions/${s.id}/analysis`
                    : `/problems/${s.problemId}`
                }
                className={cn(
                  'group flex items-center justify-between px-4 py-3 sm:px-6 sm:py-3.5 transition-all hover:bg-primary-soft',
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold transition-colors group-hover:text-primary">
                    {s.problemTitle ?? problemTitleMap.get(s.problemId) ?? `문제 ${s.problemId.slice(0, 8)}`}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    {(() => {
                      const problem = problemMap.get(s.problemId);
                      if (!problem?.difficulty) return null;
                      const diffKey = (problem.difficulty as string).toLowerCase();
                      const dotStyle = DIFF_DOT_STYLE[diffKey] ?? { backgroundColor: 'var(--text-3)' };
                      const badgeStyle = DIFF_BADGE_STYLE[diffKey] ?? { backgroundColor: 'var(--bg-alt)', color: 'var(--text-2)' };
                      const tierLevel = toTierLevel(problem.level);
                      const label = `${(problem.difficulty as string).charAt(0).toUpperCase()}${(problem.difficulty as string).slice(1).toLowerCase()}${tierLevel != null ? ` ${tierLevel}` : ''}`.trim();
                      return (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium" style={badgeStyle}>
                          <span className="h-1.5 w-1.5 rounded-full" style={dotStyle} />
                          {label}
                        </span>
                      );
                    })()}
                    <span className="rounded-full bg-bg-alt px-2 py-0.5 text-[11px] font-medium text-text-2">
                      {s.language}
                    </span>
                    <span className="text-[11px] text-text-3">
                      {formatRelativeTime(s.createdAt)}
                    </span>
                  </div>
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

      {/* 마감 임박 문제 - upcomingDeadlines가 있을 때만 렌더 */}
      {upcomingDeadlines.length > 0 && (
        <Card className="overflow-hidden p-0">
          <CardHeader className="flex flex-row items-center justify-between px-4 pb-2 pt-4">
            <CardTitle>마감 임박 문제</CardTitle>
            <Link
              href="/problems"
              className="flex items-center gap-0.5 text-[12px] font-medium text-text-3 transition-colors hover:text-primary"
            >
              전체 보기 <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
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
                    'group flex items-center justify-between px-4 py-3 sm:px-6 sm:py-3.5 transition-all hover:bg-primary-soft',
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
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <span className="font-mono text-[10px] text-text-3">
                        {p.weekNumber}
                      </span>
                      {p.difficulty && (
                        <DifficultyBadge difficulty={p.difficulty as Difficulty} level={p.level} />
                      )}
                    </div>
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
        </Card>
      )}
    </div>
  );
}

