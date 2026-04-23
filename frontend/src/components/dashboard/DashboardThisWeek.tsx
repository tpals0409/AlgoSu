/**
 * @file 대시보드 진행 중인 문제 카드 (dynamic import 대상)
 * @domain dashboard
 * @layer component
 * @related DashboardPage, DifficultyBadge
 */

'use client';

import { type ReactNode, useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useStudy } from '@/contexts/StudyContext';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import type { Problem } from '@/lib/api';
import { DifficultyBadge } from '@/components/ui/DifficultyBadge';
import { cn } from '@/lib/utils';

// ─── HELPERS ────────────────────────────

/** 번역 함수 축약 타입 */
type TranslateFn = (key: string, values?: Record<string, number | string>) => string;


function getDDay(deadline: string): { label: string; style: React.CSSProperties } {
  const diff = Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  let label: string;
  if (diff < 0) label = `D+${Math.abs(diff)}`;
  else if (diff === 0) label = 'D-Day';
  else label = `D-${diff}`;

  if (diff <= 1) return { label, style: { backgroundColor: 'var(--error-soft)', color: 'var(--error)' } };
  if (diff <= 3) return { label, style: { backgroundColor: 'var(--primary-soft)', color: 'var(--primary)' } };
  return { label, style: { backgroundColor: 'var(--bg-alt)', color: 'var(--text-2)' } };
}

/** 주차 라벨 포맷 (i18n 지원) */
function formatWeekLabel(
  deadline: string,
  t: TranslateFn,
): string {
  const d = new Date(deadline);
  return t('thisWeek.weekLabel', { month: d.getMonth() + 1, week: Math.ceil(d.getDate() / 7) });
}

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
  const { currentStudyId: _currentStudyId } = useStudy();
  const t = useTranslations('dashboard');

  const problemItems = useMemo(
    () =>
      currentWeekProblems.map((p) => {
        const isSubmitted = submittedProblemIds.has(p.id);

        return (
          <Link
            key={p.id}
            href={`/problems/${p.id}`}
            className={cn(
              'group flex items-center justify-between px-6 py-3.5 transition-all hover:bg-primary-soft',
              isSubmitted && 'opacity-50',
            )}
          >
            <div className="min-w-0 flex-1">
              <p className={cn(
                'truncate text-[13px] font-semibold transition-colors',
                isSubmitted ? 'text-text-3' : 'group-hover:text-primary',
              )}>
                {p.title}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <DifficultyBadge
                  difficulty={p.difficulty ?? null}
                  level={p.level}
                  sourcePlatform={p.sourcePlatform}
                />
                {p.deadline && (
                  <span className="text-[11px] text-text-3">
                    {formatWeekLabel(p.deadline, t)}
                  </span>
                )}
              </div>
            </div>
            {p.deadline && (() => {
              const dday = getDDay(p.deadline);
              return (
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
                  style={dday.style}
                >
                  {dday.label}
                </span>
              );
            })()}
          </Link>
        );
      }),
    [currentWeekProblems, submittedProblemIds, t],
  );

  return (
    <Card className="overflow-hidden p-0" style={fadeStyle}>
      <CardHeader className="flex flex-row items-center justify-between px-4 pb-2 pt-4">
        <CardTitle>{t('thisWeek.title')}</CardTitle>
        <Link
          href="/problems"
          className="flex items-center gap-0.5 text-[12px] font-medium text-text-3 transition-colors hover:text-primary"
        >
          {t('thisWeek.viewAll')} <ArrowRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      {isLoading ? (
        <div className="space-y-3 p-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} height={36} />
          ))}
        </div>
      ) : currentWeekProblems.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-sm text-text-3">{t('thisWeek.empty')}</p>
        </div>
      ) : (
        <div>{problemItems}</div>
      )}
    </Card>
  );
}
