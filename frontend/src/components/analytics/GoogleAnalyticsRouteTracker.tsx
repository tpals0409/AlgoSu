'use client';

/**
 * @file GoogleAnalyticsRouteTracker — App Router soft-navigation page_view 추적 클라이언트 컴포넌트
 * @domain analytics
 * @layer component
 * @related src/components/analytics/GoogleAnalytics.tsx
 *
 * Next.js App Router는 클라이언트 사이드 네비게이션(soft navigation)을 사용한다.
 * @next/third-parties의 GoogleAnalytics는 초기 로드 시 gtag('config')를 1회만 호출하므로
 * 이후 라우트 변경(pathname/searchParams 변화)은 추적되지 않는다.
 *
 * 이 컴포넌트는 pathname + searchParams 변화를 감지하여 명시적으로
 * page_view 이벤트를 전송함으로써 모든 라우트가 GA4에 기록되도록 보장한다.
 *
 * 초기 마운트 시(첫 effect 실행) sendGAEvent를 호출하지 않아
 * gtag('config')의 초기 page_view와 중복 카운트를 방지한다.
 */

import { usePathname, useSearchParams } from 'next/navigation';
import { sendGAEvent } from '@next/third-parties/google';
import { useEffect, useRef } from 'react';

/**
 * App Router 라우트 변경 시 GA4 page_view 이벤트를 전송하는 추적 컴포넌트.
 *
 * 초기 마운트는 skip하고 두 번째 렌더(실제 네비게이션)부터 page_view를 전송한다.
 * 렌더 출력이 없고 추적 사이드 이펙트만 수행한다.
 *
 * @returns null — 렌더 출력 없음
 */
export default function GoogleAnalyticsRouteTracker(): null {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    sendGAEvent('event', 'page_view', {
      page_location: window.location.href,
      page_title: document.title,
    });
  }, [pathname, searchParams]);

  return null;
}
