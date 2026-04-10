/**
 * @file       pipeline.tsx
 * @domain     blog
 * @layer      ui
 * @related    src/components/mdx-components.tsx
 *
 * 좌→우 단계 흐름. Saga 전이, GitOps 파이프라인 등 ASCII 화살표 대체.
 * 모바일에선 위→아래로 전환되고, sm 이상에서 가로 흐름.
 */
import type { ReactNode } from 'react';
import { getIcon, type IconName } from './icons';

interface PipelineProps {
  children: ReactNode;
}

interface PipelineStageProps {
  label: string;
  detail?: ReactNode;
  accent?: 1 | 2 | 3 | 4 | 5 | 6;
  icon?: IconName | string;
}

const ACCENT_BG: Record<number, string> = {
  1: 'bg-accent-1',
  2: 'bg-accent-2',
  3: 'bg-accent-3',
  4: 'bg-accent-4',
  5: 'bg-accent-5',
  6: 'bg-accent-6',
};

export function Pipeline({ children }: PipelineProps) {
  return (
    <div className="my-6 not-prose">
      <ol className="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-0">
        {children}
      </ol>
    </div>
  );
}

export function PipelineStage({ label, detail, accent = 1, icon }: PipelineStageProps) {
  const Icon = getIcon(icon);
  return (
    <li className="relative flex-1">
      <div className="h-full rounded-lg border border-border bg-surface-elevated p-3 shadow-sm sm:rounded-none sm:border-r-0 sm:first:rounded-l-lg sm:last:rounded-r-lg sm:last:border-r">
        <div className="flex items-center gap-2">
          {Icon ? (
            <span
              aria-hidden
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-white ${ACCENT_BG[accent]}`}
            >
              <Icon size={14} strokeWidth={2.5} />
            </span>
          ) : (
            <span
              aria-hidden
              className={`h-2 w-2 shrink-0 rounded-full ${ACCENT_BG[accent]}`}
            />
          )}
          <span className="text-sm font-semibold text-text">{label}</span>
        </div>
        {detail && (
          <div className="mt-1 text-xs leading-relaxed text-text-muted">{detail}</div>
        )}
      </div>
      {/* 화살표 - desktop only, last 제외 */}
      <span
        aria-hidden
        className="pointer-events-none absolute right-0 top-1/2 hidden -translate-y-1/2 translate-x-1/2 text-text-subtle sm:block sm:[li:last-child_&]:hidden"
      >
        ▶
      </span>
    </li>
  );
}
