/**
 * @file Web Vitals collection component
 * @domain common
 * @layer provider
 *
 * Collects LCP, FID, CLS, TTFB, INP metrics and outputs them as structured logging.
 * To send to a server endpoint, replace the sendToAnalytics function.
 */

'use client';

import { useReportWebVitals } from 'next/web-vitals';
import type { ReactNode } from 'react';
import { eventTracker } from '@/lib/event-tracker';

function sendToAnalytics(metric: {
  id: string;
  name: string;
  value: number;
  rating: string;
  delta: number;
  navigationType: string;
}): void {
  if (process.env.NODE_ENV === 'development') {
    const { name, value, rating } = metric;
    console.log(
      `[WebVitals] ${name}: ${Math.round(name === 'CLS' ? value * 1000 : value)}${name === 'CLS' ? '' : 'ms'} (${rating})`,
      metric,
    );
  }

  // Send via event tracker
  eventTracker?.track('WEB_VITAL', {
    meta: {
      name: metric.name,
      value: Math.round(metric.value),
      rating: metric.rating,
      delta: Math.round(metric.delta),
    },
  });
}

export function WebVitalsReporter(): ReactNode {
  useReportWebVitals((metric) => {
    sendToAnalytics({
      id: metric.id,
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      delta: metric.delta,
      navigationType: metric.navigationType,
    });
  });

  return null;
}
