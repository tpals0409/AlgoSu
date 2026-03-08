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
import { useStudy } from '@/contexts/StudyContext';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import type { Problem } from '@/lib/api';
import type { Difficulty } from '@/lib/constants';
import { cn } from '@/lib/utils';

// ─── HELPERS ────────────────────────────

/** 난이도별 도트 색상 — CSS 변수(--diff-*-color) 기반 inline style */
const DIFFICULTY_DOT_STYLE: Record<string, React.CSSProperties> = {
  bronze:   { backgroundColor: 'var(--diff-bronze-color)' },
  silver:   { backgroundColor: 'var(--diff-silver-color)' },
  gold:     { backgroundColor: 'var(--diff-gold-color)' },
  platinum: { backgroundColor: 'var(--diff-platinum-color)' },
  diamond:  { backgroundColor: 'var(--diff-diamond-color)' },
  ruby:     { backgroundColor: 'var(--diff-ruby-color)' },
};

/** 난이도별 뱃지 배경 — CSS 변수(--diff-*-bg, --diff-*-color) 기반 inline style */
const DIFFICULTY_BADGE_STYLE: Record<string, React.CSSProperties> = {
  bronze:   { backgroundColor: 'var(--diff-bronze-bg)',   color: 'var(--diff-bronze-color)' },
  silver:   { backgroundColor: 'var(--diff-silver-bg)',   color: 'var(--diff-silver-color)' },
  gold:     { backgroundColor: 'var(--diff-gold-bg)',     color: 'var(--diff-gold-color)' },
  platinum: { backgroundColor: 'var(--diff-platinum-bg)', color: 'var(--diff-platinum-color)' },
  diamond:  { backgroundColor: 'var(--diff-diamond-bg)',  color: 'var(--diff-diamond-color)' },
  ruby:     { backgroundColor: 'var(--diff-ruby-bg)',     color: 'var(--diff-ruby-color)' },
};

function getDDay(deadline: string): { label: string; style: React.CSSProperties } {
  const diff = Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  let label: string;
  if (diff < 0) label = `D+${Math.abs(diff)}`;
  else if (diff === 0) label = 'D-Day';
  else label = `D-${diff}`;

  // 긴급도별 색상 — CSS 변수 기반
  if (diff <= 1) return { label, style: { backgroundColor: 'var(--error-soft)', color: 'var(--error)' } };
  if (diff <= 3) return { label, style: { backgroundColor: 'var(--primary-soft)', color: 'var(--primary)' } };
  return { label, style: { backgroundColor: 'var(--bg-alt)', color: 'var(--text-2)' } };
}

function formatWeekLabel(deadline: string): string {
  const d = new Date(deadline);
  return `${d.getMonth() + 1}월${Math.ceil(d.getDate() / 7)}주차`;
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
  const { currentStudyId } = useStudy();

  const problemItems = useMemo(
    () =>
      currentWeekProblems.map((p) => {
        const isSubmitted = submittedProblemIds.has(p.id);
        const difficulty = (p.difficulty ?? '') as Difficulty;
        const diffKey = difficulty.toLowerCase();
        const dotStyle = DIFFICULTY_DOT_STYLE[diffKey] ?? { backgroundColor: 'var(--text-3)' };
        const badgeStyle = DIFFICULTY_BADGE_STYLE[diffKey] ?? { backgroundColor: 'var(--bg-alt)', color: 'var(--text-2)' };
        const diffLabel = difficulty ? `${difficulty.charAt(0).toUpperCase()}${difficulty.slice(1).toLowerCase()} ${p.level ?? ''}`.trim() : '';

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
                {diffLabel && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                    style={badgeStyle}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={dotStyle} />
                    {diffLabel}
                  </span>
                )}
                {p.deadline && (
                  <span className="text-[11px] text-text-3">
                    {formatWeekLabel(p.deadline)}
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
    [currentWeekProblems, submittedProblemIds],
  );

  return (
    <Card className="overflow-hidden p-0" style={fadeStyle}>
      <CardHeader className="flex flex-row items-center justify-between px-4 pb-2 pt-4">
        <CardTitle>진행 중인 문제</CardTitle>
        <Link
          href="/problems"
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
      ) : currentWeekProblems.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-sm text-text-3">진행 중인 문제가 없습니다</p>
          <Link
            href={currentStudyId ? `/studies/${currentStudyId}/room` : '/study-room'}
            className="mt-3 inline-flex items-center gap-1 rounded-btn bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-hover"
          >
            문제 보기
          </Link>
        </div>
      ) : (
        <div>{problemItems}</div>
      )}
    </Card>
  );
}
