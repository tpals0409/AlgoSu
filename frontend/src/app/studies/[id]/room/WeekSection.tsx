/**
 * @file 스터디룸 주차별 섹션 + 문제 타임라인 카드
 * @domain study
 * @layer component
 * @related page.tsx, utils.ts
 */

import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { DifficultyBadge } from '@/components/ui/DifficultyBadge';
import type { Problem } from '@/lib/api';
import { toTier, type WeekGroup } from './utils';

// ─── WEEK SECTION ────────────────────────

export interface WeekSectionProps {
  readonly week: WeekGroup;
  readonly barsAnimated: boolean;
  readonly submissionCountByProblem: Map<string, { count: number; analyzedCount: number }>;
  readonly totalMembers: number;
  readonly onSelect: (p: Problem) => void;
}

export function WeekSection({ week, barsAnimated, submissionCountByProblem, totalMembers, onSelect }: WeekSectionProps): ReactNode {
  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold"
          style={{
            backgroundColor: week.active ? 'var(--primary-soft)' : 'var(--bg-alt)',
            color: week.active ? 'var(--primary)' : 'var(--text-3)',
          }}
        >
          {week.label}
          {week.active && <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: 'var(--success)' }} />}
        </span>
        <div className="h-px flex-1" style={{ backgroundColor: 'var(--border)' }} />
        <span className="text-[11px] text-text-3">{week.problems.length}문제</span>
      </div>
      <div className="space-y-3">
        {week.problems.map((p) => (
          <ProblemTimelineCard
            key={p.id}
            problem={p}
            barsAnimated={barsAnimated}
            submittedCount={submissionCountByProblem.get(p.id)?.count ?? 0}
            totalMembers={totalMembers}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

// ─── PROBLEM TIMELINE CARD ───────────────

interface ProblemTimelineCardProps {
  readonly problem: Problem;
  readonly barsAnimated: boolean;
  readonly submittedCount: number;
  readonly totalMembers: number;
  readonly onSelect: (p: Problem) => void;
}

function ProblemTimelineCard({ problem, barsAnimated, submittedCount, totalMembers, onSelect }: ProblemTimelineCardProps): ReactNode {
  const tier = toTier(problem.difficulty);
  const isActive = problem.status === 'ACTIVE' && new Date(problem.deadline) >= new Date();
  const tags = problem.tags ?? [];
  const pct = totalMembers > 0 ? (submittedCount / totalMembers) * 100 : 0;

  return (
    <Card className="overflow-hidden p-0 cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-hover" onClick={() => onSelect(problem)}>
      <div className="flex">
        <div className="w-1 shrink-0" style={{ backgroundColor: `var(--diff-${tier}-color)` }} />
        <div className="flex-1 px-3 py-3 sm:px-5 sm:py-4">
          <div className="flex items-center gap-2 mb-2">
            <DifficultyBadge difficulty={problem.difficulty} level={problem.level} />
            {isActive ? (
              <span className="inline-flex items-center gap-1 rounded-badge px-2 py-0.5 text-[11px] font-medium" style={{ color: 'var(--success)', backgroundColor: 'var(--success-soft)' }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: 'var(--success)' }} />진행 중
              </span>
            ) : (
              <span className="inline-flex items-center rounded-badge px-2 py-0.5 text-[11px] font-medium" style={{ color: 'var(--text-3)', backgroundColor: 'var(--bg-alt)' }}>종료</span>
            )}
          </div>
          <h3 className="text-[15px] font-bold text-text mb-1.5">{problem.title}</h3>
          {tags.length > 0 && (
            <div className="flex items-center gap-1.5 mb-3">
              {tags.map((tag) => (
                <span key={tag} className="rounded-badge px-2 py-0.5 text-[11px]" style={{ backgroundColor: 'var(--bg-alt)', color: 'var(--text-3)' }}>{tag}</span>
              ))}
            </div>
          )}
          <div className="h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: 'var(--bg-alt)' }}>
            <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: barsAnimated ? `${pct}%` : '0%', backgroundColor: `var(--diff-${tier}-color)` }} />
          </div>
          <div className="mt-2 flex items-center justify-end gap-3 text-[11px] text-text-3">
            <span>{submittedCount} / {totalMembers}명</span>
          </div>
        </div>
        <div className="flex items-center pr-4"><ChevronRight className="h-4 w-4 text-text-3" /></div>
      </div>
    </Card>
  );
}
