/**
 * @file AI 카테고리별 점수 바
 * @domain ai
 * @layer component
 *
 * 클릭 시 코드 하이라이트 연동 (선택 상태 외부 관리).
 */

'use client';

import type { ReactElement } from 'react';
import { useAnimVal } from '@/hooks/useAnimVal';
import { cn } from '@/lib/utils';

type CategoryColor = 'success' | 'warning' | 'error';

export interface CategoryItem {
  category: string;
  score: number;
  grade: string;
  color: CategoryColor;
  comment: string;
}

interface CategoryBarProps {
  readonly item: CategoryItem;
  readonly selected?: boolean;
  readonly onClick?: () => void;
  readonly className?: string;
}

const COLOR_MAP: Record<CategoryColor, { bar: string; badge: string }> = {
  success: { bar: 'bg-success', badge: 'bg-success-soft text-success' },
  warning: { bar: 'bg-warning', badge: 'bg-warning-soft text-warning' },
  error: { bar: 'bg-error', badge: 'bg-error-soft text-error' },
};

export function CategoryBar({
  item,
  selected = false,
  onClick,
  className,
}: CategoryBarProps): ReactElement {
  const [ref, animWidth] = useAnimVal(item.score, 800);
  const colors = COLOR_MAP[item.color];

  return (
    <div
      ref={ref}
      onClick={onClick}
      className={cn(
        'cursor-pointer border-b border-border px-6 py-4 transition-colors',
        selected ? 'border-l-[3px] border-l-primary bg-primary-soft' : 'border-l-[3px] border-l-transparent',
        className,
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn('text-[13px]', selected ? 'font-semibold' : 'font-medium')}>
            {item.category}
          </span>
          <span className={cn('rounded-badge px-2.5 py-0.5 text-[11px] font-medium leading-none', colors.badge)}>
            {item.grade}
          </span>
        </div>
        <span className={cn('font-mono text-sm font-semibold', colors.badge.split(' ').pop())}>
          {Math.round(animWidth)}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-border">
        <div
          className={cn('h-full rounded-full transition-[width] duration-100 ease-linear', colors.bar)}
          style={{ width: `${animWidth}%` }}
        />
      </div>
      <p className="mt-2 text-xs leading-relaxed text-text-2">{item.comment}</p>
    </div>
  );
}
