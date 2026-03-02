/**
 * @file 뒤로가기 버튼
 * @domain common
 * @layer component
 */

'use client';

import type { ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

interface BackBtnProps {
  readonly label?: string;
  readonly href?: string;
  readonly className?: string;
}

export function BackBtn({
  label = '뒤로',
  href,
  className,
}: BackBtnProps): ReactElement {
  const router = useRouter();

  const handleClick = (): void => {
    if (href) {
      router.push(href);
    } else {
      router.back();
    }
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        'inline-flex items-center gap-1 border-none bg-transparent p-0 text-xs text-text-3 transition-colors hover:text-text',
        className,
      )}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
      {label}
    </button>
  );
}
