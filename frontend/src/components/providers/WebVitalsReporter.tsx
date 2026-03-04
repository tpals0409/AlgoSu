/**
 * @file Web Vitals 수집 컴포넌트
 * @domain common
 * @layer provider
 *
 * LCP, FID, CLS, TTFB, INP 메트릭을 수집하여 structured logging으로 출력.
 * 향후 서버 엔드포인트 전송 시 sendToAnalytics 함수만 교체하면 됨.
 */

'use client';

import { useReportWebVitals } from 'next/web-vitals';
import type { ReactNode } from 'react';

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

  // TODO: 향후 서버 엔드포인트로 전송
  // fetch('/api/vitals', { method: 'POST', body: JSON.stringify(metric) });
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
