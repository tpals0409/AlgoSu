/**
 * @file 언어 뱃지 (mono font)
 * @domain submission
 * @layer component
 */

import type { ReactElement } from 'react';
import { cn } from '@/lib/utils';

interface LangBadgeProps {
  readonly language: string;
  readonly className?: string;
}

export function LangBadge({ language, className }: LangBadgeProps): ReactElement {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-badge bg-muted-soft px-2.5 py-0.5 font-mono text-[11px] font-medium leading-none text-muted',
        className,
      )}
    >
      {language}
    </span>
  );
}
