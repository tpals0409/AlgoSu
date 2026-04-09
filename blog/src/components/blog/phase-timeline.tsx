/**
 * @file       phase-timeline.tsx
 * @domain     blog
 * @layer      ui
 * @related    src/components/mdx-components.tsx
 *
 * Phase 마일스톤 타임라인. 좌측 세로 axis + 우측 카드.
 * sprint-journey의 4-Phase 마일스톤 박스 대체.
 */
import type { ReactNode } from 'react';
import { getIcon, type IconName } from './icons';

interface PhaseTimelineProps {
  children: ReactNode;
}

interface PhaseMilestoneProps {
  phase: string;
  title: string;
  period?: string;
  status?: 'done' | 'active' | 'planned';
  icon?: IconName | string;
  accent?: 1 | 2 | 3 | 4 | 5 | 6;
  children?: ReactNode;
}

const ACCENT_BG: Record<number, string> = {
  1: 'bg-accent-1',
  2: 'bg-accent-2',
  3: 'bg-accent-3',
  4: 'bg-accent-4',
  5: 'bg-accent-5',
  6: 'bg-accent-6',
};

const STATUS_LABEL: Record<NonNullable<PhaseMilestoneProps['status']>, string> = {
  done: '완료',
  active: '진행 중',
  planned: '예정',
};

const STATUS_BG: Record<NonNullable<PhaseMilestoneProps['status']>, string> = {
  done: 'bg-callout-success-bg text-callout-success-fg',
  active: 'bg-callout-info-bg text-callout-info-fg',
  planned: 'bg-callout-warn-bg text-callout-warn-fg',
};

export function PhaseTimeline({ children }: PhaseTimelineProps) {
  return (
    <ol className="my-6 flex flex-col gap-4 not-prose">{children}</ol>
  );
}

export function PhaseMilestone({
  phase,
  title,
  period,
  status = 'done',
  icon,
  accent = 1,
  children,
}: PhaseMilestoneProps) {
  const Icon = getIcon(icon);
  return (
    <li className="group/phase relative pl-12 sm:pl-14">
      {/* 좌측 axis dot */}
      <span
        aria-hidden
        className={`absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-white shadow-md sm:left-4 ${ACCENT_BG[accent]}`}
      >
        {Icon ? (
          <Icon size={14} strokeWidth={2.5} />
        ) : (
          <span className="h-2 w-2 rounded-full bg-white" />
        )}
      </span>
      {/* 좌측 axis line — 마지막 항목은 숨김 */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-[1.625rem] top-10 h-[calc(100%-0.5rem)] w-px group-last/phase:hidden sm:left-[1.875rem]"
        style={{ backgroundColor: 'var(--border-strong)' }}
      />
      {/* 카드 */}
      <div
        className="rounded-xl border bg-surface-elevated p-4 shadow-sm"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="mb-1 flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-subtle">
              {phase}
            </span>
            {period && (
              <span className="font-mono text-[10px] text-text-muted">{period}</span>
            )}
          </div>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_BG[status]}`}
          >
            {STATUS_LABEL[status]}
          </span>
        </div>
        <h4 className="text-base font-bold text-text">{title}</h4>
        {children && (
          <div className="mt-2 text-sm leading-relaxed text-text-muted [&>p]:m-0 [&>p+p]:mt-2">
            {children}
          </div>
        )}
      </div>
    </li>
  );
}
