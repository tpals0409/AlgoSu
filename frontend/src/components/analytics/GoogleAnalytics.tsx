/**
 * @file GoogleAnalytics 서버 컴포넌트 래퍼 — GA4 추적 스크립트 조건부 주입
 * @domain analytics
 * @layer component
 * @related src/app/layout.tsx, sentry.client.config.ts, src/components/analytics/GoogleAnalyticsRouteTracker.tsx
 *
 * NEXT_PUBLIC_GA_MEASUREMENT_ID 환경변수가 설정된 경우에만 GA4 스크립트를 주입한다.
 * 미설정 시 null 반환(no-op) — 개발/스테이징 환경에서 측정 ID 없이도 안전하게 동작한다.
 * Sentry의 조건부 활성화 패턴(enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN)과 동일한 방식.
 *
 * App Router soft-navigation page_view 추적을 위해 GoogleAnalyticsRouteTracker를
 * Suspense 경계 내에 함께 렌더한다. useSearchParams가 Suspense 경계를 요구하므로
 * fallback={null}로 감싸 빌드 deopt를 방지한다.
 */

import { Suspense } from 'react';
import { GoogleAnalytics as NextGoogleAnalytics } from '@next/third-parties/google';
import GoogleAnalyticsRouteTracker from './GoogleAnalyticsRouteTracker';

/**
 * GA4 측정 스크립트 서버 컴포넌트.
 *
 * NEXT_PUBLIC_GA_MEASUREMENT_ID 환경변수가 존재하면 @next/third-parties의
 * GoogleAnalytics 컴포넌트와 라우트 변경 추적 컴포넌트를 함께 렌더링하고,
 * 없으면 null을 반환한다.
 *
 * @returns GA4 스크립트 + 라우트 트래커 Fragment, 또는 null
 */
export default function GoogleAnalytics(): React.ReactElement | null {
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  if (!measurementId) {
    return null;
  }

  return (
    <>
      <NextGoogleAnalytics gaId={measurementId} />
      <Suspense fallback={null}>
        <GoogleAnalyticsRouteTracker />
      </Suspense>
    </>
  );
}
