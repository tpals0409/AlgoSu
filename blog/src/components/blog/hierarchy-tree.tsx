/**
 * @file       hierarchy-tree.tsx
 * @domain     blog
 * @layer      ui
 * @related    src/components/mdx-components.tsx
 *
 * 위계 트리 (PM → Oracle → Agents). 순수 Tailwind/CSS 커넥터.
 * 데스크톱은 들여쓰기 + 좌측 connector, 모바일은 세로 스택 + left border.
 * groupLabel prop: 같은 level 내 Tier 구분 섹션 라벨을 노드 바로 위에 렌더.
 * 커넥터는 상단 연장 rail + hook(세로 + 가로)의 2-피스 구성으로 형제 간 트리 연결감 확보.
 */
import type { ReactNode } from 'react';
import { getIcon, type IconName } from './icons';

interface HierarchyTreeProps {
  children: ReactNode;
}

interface HierarchyNodeProps {
  label: string;
  sublabel?: string;
  icon?: IconName | string;
  level?: 0 | 1 | 2 | 3;
  variant?: 'box' | 'pill';
  accent?: 1 | 2 | 3 | 4 | 5 | 6;
  /** 이 노드 위에 그룹 구분 라벨(예: "Tier 1 — 안정성")을 렌더. 같은 level 내 섹션 분리용 */
  groupLabel?: string;
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

const ACCENT_BORDER_L: Record<number, string> = {
  1: 'border-l-accent-1',
  2: 'border-l-accent-2',
  3: 'border-l-accent-3',
  4: 'border-l-accent-4',
  5: 'border-l-accent-5',
  6: 'border-l-accent-6',
};

const LEVEL_INDENT: Record<number, string> = {
  0: 'ml-0',
  1: 'ml-4 sm:ml-8',
  2: 'ml-8 sm:ml-16',
  3: 'ml-12 sm:ml-24',
};

export function HierarchyTree({ children }: HierarchyTreeProps) {
  return (
    <div className="my-6 rounded-xl border border-border bg-diagram-bg p-4 sm:p-6 not-prose">
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

export function HierarchyNode({
  label,
  sublabel,
  icon,
  level = 0,
  variant = 'box',
  accent = 1,
  groupLabel,
  children,
}: HierarchyNodeProps) {
  const Icon = getIcon(icon);
  const isPill = variant === 'pill';
  return (
    <>
      {groupLabel && (
        <div className={`mt-3 flex items-center gap-2 ${LEVEL_INDENT[level]}`}>
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
            {groupLabel}
          </span>
          <span className="h-px flex-1 bg-border" />
        </div>
      )}
      <div className={`relative ${LEVEL_INDENT[level]}`}>
        {/* 좌측 커넥터 — level > 0일 때 표시 */}
        {level > 0 && (
          <>
            {/* 위 형제(또는 부모)와 이어주는 상단 연장 rail */}
            <span
              aria-hidden
              className="pointer-events-none absolute -left-4 -top-2 h-3 w-0.5 bg-border-strong sm:-left-6"
            />
            {/* 현재 노드 hook — 세로선(상단→중앙) + 가로선(중앙) */}
            <span
              aria-hidden
              className="pointer-events-none absolute -left-4 top-0 h-full w-4 sm:-left-6 sm:w-6"
            >
              <span className="absolute left-0 top-0 h-1/2 w-0.5 bg-border-strong" />
              <span className="absolute left-0 top-1/2 h-0.5 w-full bg-border-strong" />
            </span>
          </>
        )}
        <div
          className={`inline-flex items-center gap-2 border border-border bg-surface-elevated shadow-sm ${
            isPill
              ? 'rounded-full px-3 py-1.5'
              : `rounded-lg border-l-4 px-3 py-2 ${ACCENT_BORDER_L[accent]}`
          }`}
        >
          {Icon && (
            <span
              aria-hidden
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-white ${ACCENT_BG[accent]}`}
            >
              <Icon size={14} strokeWidth={2.5} />
            </span>
          )}
          <span className="text-sm font-semibold text-text">{label}</span>
          {sublabel && <span className="text-[11px] text-text-muted">· {sublabel}</span>}
        </div>
        {children && <div className="mt-2 text-xs text-text-muted">{children}</div>}
      </div>
    </>
  );
}
