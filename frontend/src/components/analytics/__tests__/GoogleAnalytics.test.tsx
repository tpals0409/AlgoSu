/**
 * @file GoogleAnalytics 서버 컴포넌트 래퍼 단위 테스트
 * @domain analytics
 * @layer component
 * @related src/components/analytics/GoogleAnalytics.tsx, src/components/analytics/GoogleAnalyticsRouteTracker.tsx, sentry.client.config.ts
 *
 * 주요 분기:
 *   - NEXT_PUBLIC_GA_MEASUREMENT_ID 설정 시 GA 스크립트가 gaId prop과 함께 렌더됨
 *   - 설정 시 GoogleAnalyticsRouteTracker도 함께 렌더됨 (Suspense 경계 포함)
 *   - 미설정(undefined) 시 아무것도 렌더 안 됨(null)
 *   - 빈 문자열 시 아무것도 렌더 안 됨(null)
 */

import React from 'react';
import { render } from '@testing-library/react';
import GoogleAnalytics from '../GoogleAnalytics';

// ── @next/third-parties/google 모킹 ──────────────────────────────────────────

const MockNextGoogleAnalytics = jest.fn(
  ({ gaId }: { gaId: string }) => <div data-testid="ga-script" data-ga-id={gaId} />,
);

jest.mock('@next/third-parties/google', () => ({
  GoogleAnalytics: (props: { gaId: string }) => MockNextGoogleAnalytics(props),
}));

// ── GoogleAnalyticsRouteTracker 모킹 ─────────────────────────────────────────

const MockRouteTracker = jest.fn(() => null);

jest.mock('../GoogleAnalyticsRouteTracker', () => ({
  __esModule: true,
  default: () => MockRouteTracker(),
}));

// ── next/navigation 모킹 (Suspense 내 useSearchParams 의존성) ────────────────

jest.mock('next/navigation', () => ({
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(''),
}));

// ── 환경변수 헬퍼 ─────────────────────────────────────────────────────────────

/** process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID 를 안전하게 설정/복원한다. */
function withMeasurementId(id: string | undefined, fn: () => void): void {
  const original = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  if (id === undefined) {
    delete process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  } else {
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = id;
  }
  try {
    fn();
  } finally {
    if (original === undefined) {
      delete process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
    } else {
      process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = original;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. 측정 ID 설정 시 — GA 스크립트 렌더
// ═══════════════════════════════════════════════════════════════════════════════

describe('GoogleAnalytics — 측정 ID 설정 시', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('NextGoogleAnalytics 컴포넌트를 렌더링한다', () => {
    withMeasurementId('G-TESTID1234', () => {
      const { getByTestId } = render(<GoogleAnalytics />);
      expect(getByTestId('ga-script')).toBeInTheDocument();
    });
  });

  it('gaId prop에 측정 ID를 전달한다', () => {
    withMeasurementId('G-TESTID1234', () => {
      render(<GoogleAnalytics />);
      expect(MockNextGoogleAnalytics).toHaveBeenCalledWith(
        expect.objectContaining({ gaId: 'G-TESTID1234' }),
      );
    });
  });

  it('NextGoogleAnalytics를 정확히 1번 호출한다', () => {
    withMeasurementId('G-ANOTHER567', () => {
      render(<GoogleAnalytics />);
      expect(MockNextGoogleAnalytics).toHaveBeenCalledTimes(1);
    });
  });

  it('측정 ID 설정 시 GoogleAnalyticsRouteTracker를 렌더링한다', () => {
    withMeasurementId('G-TESTID1234', () => {
      render(<GoogleAnalytics />);
      expect(MockRouteTracker).toHaveBeenCalled();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. 측정 ID 미설정 시 — no-op (null)
// ═══════════════════════════════════════════════════════════════════════════════

describe('GoogleAnalytics — 측정 ID 미설정 시', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('undefined 시 아무것도 렌더링하지 않는다', () => {
    withMeasurementId(undefined, () => {
      const { container } = render(<GoogleAnalytics />);
      expect(container.firstChild).toBeNull();
    });
  });

  it('undefined 시 NextGoogleAnalytics 컴포넌트를 호출하지 않는다', () => {
    withMeasurementId(undefined, () => {
      render(<GoogleAnalytics />);
      expect(MockNextGoogleAnalytics).not.toHaveBeenCalled();
    });
  });

  it('빈 문자열 시 아무것도 렌더링하지 않는다', () => {
    withMeasurementId('', () => {
      const { container } = render(<GoogleAnalytics />);
      expect(container.firstChild).toBeNull();
    });
  });

  it('빈 문자열 시 NextGoogleAnalytics 컴포넌트를 호출하지 않는다', () => {
    withMeasurementId('', () => {
      render(<GoogleAnalytics />);
      expect(MockNextGoogleAnalytics).not.toHaveBeenCalled();
    });
  });

  it('측정 ID 미설정 시 GoogleAnalyticsRouteTracker를 렌더링하지 않는다', () => {
    withMeasurementId(undefined, () => {
      render(<GoogleAnalytics />);
      expect(MockRouteTracker).not.toHaveBeenCalled();
    });
  });
});
