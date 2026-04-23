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
import { useTranslations } from 'next-intl';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { DifficultyBadge } from '@/components/ui/DifficultyBadge';
import { Skeleton } from '@/components/ui/Skeleton';
import type { Submission, Problem } from '@/lib/api';
import { SAGA_STEP_CONFIG, type SagaStep } from '@/lib/constants';
import type { Difficulty } from '@/lib/constants';
import { cn } from '@/lib/utils';


// ─── HELPERS ─────────────────────────────

/** 번역 함수 축약 타입 */
type TranslateFn = (key: string, values?: Record<string, number | string>) => string;

/** 상대 시간 포맷 (i18n 지원) */
function formatRelativeTime(dateStr: string, t: TranslateFn): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return t('twoColumn.justNow');
  if (diffMin < 60) return t('twoColumn.minutesAgo', { count: diffMin });
  if (diffHour < 24) return t('twoColumn.hoursAgo', { count: diffHour });
  if (diffDay < 7) return t('twoColumn.daysAgo', { count: diffDay });

  const d = new Date(dateStr);
  return t('twoColumn.dateShort', { month: d.getMonth() + 1, day: d.getDate() });
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
  const t = useTranslations('dashboard');
  const problemMap = new Map(allProblems.map((p) => [p.id, p]));
  return (
    <div className={upcomingDeadlines.length > 0 ? "grid gap-3.5 md:grid-cols-2" : "block"} style={fadeStyle}>

      {/* Recent Submissions */}
      <Card className="overflow-hidden p-0">
        <CardHeader className="flex flex-row items-center justify-between px-4 pb-2 pt-4">
          <CardTitle>{t('twoColumn.recentSubmissions')}</CardTitle>
          <Link
            href="/submissions"
            className="flex items-center gap-0.5 text-[12px] font-medium text-text-3 transition-colors hover:text-primary"
          >
            {t('twoColumn.viewAll')} <ArrowRight className="h-3 w-3" />
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
            {t('twoColumn.noSubmissions')}
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
                    {s.problemTitle ?? problemTitleMap.get(s.problemId) ?? t('twoColumn.problemFallback', { id: s.problemId.slice(0, 8) })}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    {(() => {
                      const problem = problemMap.get(s.problemId);
                      if (!problem) return null;
                      return (
                        <DifficultyBadge
                          difficulty={problem.difficulty ?? null}
                          level={problem.level}
                          sourcePlatform={problem.sourcePlatform}
                        />
                      );
                    })()}
                    <span className="rounded-full bg-bg-alt px-2 py-0.5 text-[11px] font-medium text-text-2">
                      {s.language}
                    </span>
                    <span className="text-[11px] text-text-3">
                      {formatRelativeTime(s.createdAt, t)}
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

      {/* Upcoming Deadlines */}
      {upcomingDeadlines.length > 0 && (
        <Card className="overflow-hidden p-0">
          <CardHeader className="flex flex-row items-center justify-between px-4 pb-2 pt-4">
            <CardTitle>{t('twoColumn.upcomingDeadlines')}</CardTitle>
            <Link
              href="/problems"
              className="flex items-center gap-0.5 text-[12px] font-medium text-text-3 transition-colors hover:text-primary"
            >
              {t('twoColumn.viewAll')} <ArrowRight className="h-3 w-3" />
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
                      <DifficultyBadge
                        difficulty={(p.difficulty as Difficulty | undefined) ?? null}
                        level={p.level}
                        sourcePlatform={p.sourcePlatform}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isSubmitted && (
                      <Badge variant="success">{t('twoColumn.submitted')}</Badge>
                    )}
                    <span className={cn(
                      'flex items-center gap-1 font-mono text-[11px] whitespace-nowrap',
                      isUrgent ? 'font-medium text-error animate-pulse-dot' : 'text-text-3',
                    )}>
                      <Clock className="h-3 w-3" aria-hidden />
                      {diffDays > 0
                        ? t('twoColumn.daysLeft', { count: diffDays })
                        : diffHours > 0
                          ? t('twoColumn.hoursLeft', { count: diffHours })
                          : t('twoColumn.closingSoon')}
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
