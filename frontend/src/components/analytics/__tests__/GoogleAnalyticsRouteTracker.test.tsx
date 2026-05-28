/**
 * @file GoogleAnalyticsRouteTracker 단위 테스트
 * @domain analytics
 * @layer component
 * @related src/components/analytics/GoogleAnalyticsRouteTracker.tsx
 *
 * 검증 분기:
 *   - 초기 마운트 시 sendGAEvent 미호출 (gtag 초기 page_view 중복 방지)
 *   - pathname 변경(rerender) 시 sendGAEvent('event', 'page_view', payload) 호출
 *   - searchParams 변경 시 sendGAEvent 호출
 *   - payload에 page_location(string) / page_title 포함 검증
 *
 * jsdom 주의:
 *   window.location.href는 jsdom에서 non-configurable이며 직접 할당 시
 *   navigation을 트리거("Not implemented" 오류).
 *   따라서 page_location은 타입(string) 검증, page_title은 document.title로 정밀 검증한다.
 */

import React from 'react';
import { render } from '@testing-library/react';
import GoogleAnalyticsRouteTracker from '../GoogleAnalyticsRouteTracker';

// ── @next/third-parties/google 모킹 ──────────────────────────────────────────

const mockSendGAEvent = jest.fn();

jest.mock('@next/third-parties/google', () => ({
  sendGAEvent: (...args: unknown[]) => mockSendGAEvent(...args),
}));

// ── next/navigation 모킹 ─────────────────────────────────────────────────────

let mockPathname = '/';
let mockSearchParams = new URLSearchParams('');

jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearchParams,
}));

// ── 공통 setup ───────────────────────────────────────────────────────────────

beforeEach(() => {
  mockSendGAEvent.mockClear();
  mockPathname = '/';
  mockSearchParams = new URLSearchParams('');
  document.title = 'Initial Title';
});

// ═══════════════════════════════════════════════════════════════════════════════
// 1. 초기 마운트 — sendGAEvent 미호출
// ═══════════════════════════════════════════════════════════════════════════════

describe('GoogleAnalyticsRouteTracker — 초기 마운트', () => {
  it('초기 마운트 시 sendGAEvent를 호출하지 않는다', () => {
    render(<GoogleAnalyticsRouteTracker />);
    expect(mockSendGAEvent).not.toHaveBeenCalled();
  });

  it('null을 반환하여 DOM에 요소를 추가하지 않는다', () => {
    const { container } = render(<GoogleAnalyticsRouteTracker />);
    expect(container.firstChild).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. pathname 변경 — sendGAEvent 호출
// ═══════════════════════════════════════════════════════════════════════════════

describe('GoogleAnalyticsRouteTracker — pathname 변경', () => {
  it('pathname 변경(rerender) 시 sendGAEvent를 호출한다', () => {
    const { rerender } = render(<GoogleAnalyticsRouteTracker />);
    expect(mockSendGAEvent).not.toHaveBeenCalled();

    mockPathname = '/about';
    document.title = 'About Page';

    rerender(<GoogleAnalyticsRouteTracker />);

    expect(mockSendGAEvent).toHaveBeenCalledTimes(1);
  });

  it("pathname 변경 시 sendGAEvent를 'event', 'page_view' 인자로 호출한다", () => {
    const { rerender } = render(<GoogleAnalyticsRouteTracker />);

    mockPathname = '/about';
    document.title = 'About Page';

    rerender(<GoogleAnalyticsRouteTracker />);

    expect(mockSendGAEvent).toHaveBeenCalledWith(
      'event',
      'page_view',
      expect.any(Object),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. searchParams 변경 — sendGAEvent 호출
// ═══════════════════════════════════════════════════════════════════════════════

describe('GoogleAnalyticsRouteTracker — searchParams 변경', () => {
  it('searchParams 변경(rerender) 시 sendGAEvent를 호출한다', () => {
    const { rerender } = render(<GoogleAnalyticsRouteTracker />);
    expect(mockSendGAEvent).not.toHaveBeenCalled();

    mockSearchParams = new URLSearchParams('tab=results');

    rerender(<GoogleAnalyticsRouteTracker />);

    expect(mockSendGAEvent).toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. payload 검증 — page_location / page_title 포함
// ═══════════════════════════════════════════════════════════════════════════════

describe('GoogleAnalyticsRouteTracker — payload 검증', () => {
  it('payload에 page_location(string) 키를 포함한다', () => {
    // jsdom에서 window.location.href는 non-configurable + navigation trigger이므로
    // 값 타입(string) 수준 검증. 실제 브라우저에서는 현재 URL이 기록된다.
    const { rerender } = render(<GoogleAnalyticsRouteTracker />);

    mockPathname = '/problems';
    document.title = 'Problems';

    rerender(<GoogleAnalyticsRouteTracker />);

    expect(mockSendGAEvent).toHaveBeenCalledWith(
      'event',
      'page_view',
      expect.objectContaining({ page_location: expect.any(String) }),
    );
  });

  it('payload에 page_title을 document.title 값으로 포함한다', () => {
    const { rerender } = render(<GoogleAnalyticsRouteTracker />);

    const expectedTitle = 'Problems — AlgoSu';
    mockPathname = '/problems';
    document.title = expectedTitle;

    rerender(<GoogleAnalyticsRouteTracker />);

    expect(mockSendGAEvent).toHaveBeenCalledWith(
      'event',
      'page_view',
      expect.objectContaining({ page_title: expectedTitle }),
    );
  });
});
