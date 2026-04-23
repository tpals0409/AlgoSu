/**
 * @file Event tracker Provider — auto-records PAGE_VIEW on route changes
 * @domain common
 * @layer provider
 */

'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { eventTracker } from '@/lib/event-tracker';
import type { ReactNode } from 'react';

export function EventTrackerProvider(): ReactNode {
  const pathname = usePathname();
  const prevPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (pathname && pathname !== prevPathRef.current) {
      prevPathRef.current = pathname;
      eventTracker?.track('PAGE_VIEW', { page: pathname });
    }
  }, [pathname]);

  useEffect(() => {
    return () => {
      eventTracker?.destroy();
    };
  }, []);

  return null;
}
