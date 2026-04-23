/**
 * @file AI category score bar
 * @domain ai
 * @layer component
 *
 * Clicking links to code highlighting (selection state managed externally).
 */

'use client';

import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('ui');
  const [ref, animWidth] = useAnimVal(item.score, 800);
  const colors = COLOR_MAP[item.color];

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } }}
      aria-pressed={selected}
      aria-label={t('categoryBar.ariaLabel', { category: item.category, grade: item.grade, score: item.score })}
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
      <div
        className="h-1.5 overflow-hidden rounded-full bg-border"
        role="progressbar"
        aria-valuenow={item.score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t('categoryBar.scoreLabel', { category: item.category })}
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-100 ease-linear', colors.bar)}
          style={{ width: `${animWidth}%` }}
          aria-hidden="true"
        />
      </div>
      <p className="mt-2 text-xs leading-relaxed text-text-2">{item.comment}</p>
    </div>
  );
}
