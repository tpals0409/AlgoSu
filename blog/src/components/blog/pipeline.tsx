/**
 * @file       pipeline.tsx
 * @domain     blog
 * @layer      ui
 * @related    src/components/mdx-components.tsx
 *
 * 독립 카드 그리드 레이아웃.
 * 모바일 2열, sm 이상에서 자식 수에 맞춰 균등 배치.
 * 순서형 흐름에는 카드 사이 → 화살표 표시.
 */
import { Children, type ReactNode } from 'react';
import { getIcon, type IconName } from './icons';

interface PipelineProps {
  children: ReactNode;
  /** true이면 카드 사이에 → 화살표 표시 (순서형 흐름) */
  arrows?: boolean;
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

/** 자식 수에 맞는 sm grid-cols 클래스 */
function smCols(count: number): string {
  if (count <= 2) return 'sm:grid-cols-2';
  if (count === 3) return 'sm:grid-cols-3';
  if (count === 4) return 'sm:grid-cols-4';
  return 'sm:grid-cols-5';
}

export function Pipeline({ children, arrows }: PipelineProps) {
  const count = Children.count(children);
  const items = Children.toArray(children);

  return (
    <div className="my-6 not-prose">
      <ol className={`grid grid-cols-2 gap-3 ${smCols(count)}`}>
        {items.map((child, i) => (
          <li key={i} className="relative">
            {child}
            {arrows && i < count - 1 && (
              <span
                aria-hidden
                className="pointer-events-none absolute -right-2.5 top-1/2 hidden -translate-y-1/2 text-xs text-text-subtle sm:block"
              >
                →
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function PipelineStage({ label, detail, accent = 1, icon }: PipelineStageProps) {
  const Icon = getIcon(icon);
  return (
    <div className="h-full rounded-lg border border-border bg-surface-elevated p-3 shadow-sm">
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
  );
}
