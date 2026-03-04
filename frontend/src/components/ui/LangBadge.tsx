/**
 * @file 언어 뱃지 (mono font)
 * @domain submission
 * @layer component
 */

import React, { type ReactElement } from 'react';
import { cn } from '@/lib/utils';

interface LangBadgeProps {
  readonly language: string;
  readonly className?: string;
}

export const LangBadge = React.memo(function LangBadge({ language, className }: LangBadgeProps): ReactElement {
  return (
    <span
      aria-label={`프로그래밍 언어 ${language}`}
      className={cn(
        'inline-flex items-center rounded-badge bg-muted-soft px-2.5 py-0.5 font-mono text-[11px] font-medium leading-none text-muted',
        className,
      )}
    >
      {language}
    </span>
  );
});
