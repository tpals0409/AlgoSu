/**
 * @file 대시보드 이번주 문제 카드 (dynamic import 대상)
 * @domain dashboard
 * @layer component
 * @related DashboardPage, DifficultyBadge
 */

'use client';

import { type ReactNode, useMemo } from 'react';
import Link from 'next/link';
import { BookOpen, CheckCircle2 } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { DifficultyBadge } from '@/components/ui/DifficultyBadge';
import { Skeleton } from '@/components/ui/Skeleton';
import type { Problem } from '@/lib/api';
import type { Difficulty } from '@/lib/constants';
import { cn, getCurrentWeekLabel } from '@/lib/utils';

// ─── TYPES ───────────────────────────────

export interface DashboardThisWeekProps {
  readonly currentWeekProblems: Problem[];
  readonly submittedProblemIds: Set<string>;
  readonly isLoading: boolean;
  readonly fadeStyle: React.CSSProperties;
}

// ─── COMPONENT ───────────────────────────

export default function DashboardThisWeek({
  currentWeekProblems,
  submittedProblemIds,
  isLoading,
  fadeStyle,
}: DashboardThisWeekProps): ReactNode {
  const weekLabel = useMemo(() => getCurrentWeekLabel(), []);

  const problemItems = useMemo(
    () =>
      currentWeekProblems.map((p, i) => {
        const isSubmitted = submittedProblemIds.has(p.id);
        return (
          <Link
            key={p.id}
            href={`/problems/${p.id}`}
            className={cn(
              'group flex items-center justify-between px-4 py-3.5 transition-all hover:bg-primary-soft',
              i < currentWeekProblems.length - 1 && 'border-b border-border',
              isSubmitted && 'opacity-50',
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
                {p.difficulty && (
                  <DifficultyBadge difficulty={p.difficulty as Difficulty} level={p.level} />
                )}
                {p.deadline && (
                  <span className="font-mono text-[10px] text-text-3">
                    마감 {new Date(p.deadline).getMonth() + 1}.{new Date(p.deadline).getDate()}
                  </span>
                )}
              </div>
            </div>
            {isSubmitted ? (
              <Badge variant="success">제출 완료</Badge>
            ) : (
              <Badge variant="warning">미제출</Badge>
            )}
          </Link>
        );
      }),
    [currentWeekProblems, submittedProblemIds],
  );

  return (
    <Card className="overflow-hidden p-0" style={fadeStyle}>
      <CardHeader className="flex flex-row items-center gap-2.5 border-b border-border">
        <BookOpen className="h-4 w-4 text-primary" aria-hidden />
        <CardTitle>이번주 문제</CardTitle>
        <Badge variant="muted">{weekLabel}</Badge>
      </CardHeader>
      {isLoading ? (
        <div className="space-y-3 p-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} height={36} />
          ))}
        </div>
      ) : currentWeekProblems.length === 0 ? (
        <p className="py-8 text-center text-sm text-text-3">
          이번주 등록된 문제가 없습니다
        </p>
      ) : (
        <div>{problemItems}</div>
      )}
    </Card>
  );
}
