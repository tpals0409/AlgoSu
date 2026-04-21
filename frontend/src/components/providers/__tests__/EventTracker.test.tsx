/**
 * @file EventTrackerProvider 단위 테스트
 * @domain common
 * @layer provider
 * @related lib/event-tracker
 *
 * Sprint 106 [A-1]: branches 커버리지 상향 목표
 * 주요 분기:
 *   - pathname 있음/없음
 *   - pathname 변경됨/동일함
 *   - eventTracker null/non-null
 *   - eventTracker.destroy 호출 (unmount)
 */

import React from 'react';
import { render, act } from '@testing-library/react';

// ── next/navigation mock ──────────────────────────────

const mockPathname = { value: '/dashboard' as string | null };

jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname.value,
}));

// ── @/lib/event-tracker mock ─────────────────────────

const mockTrack = jest.fn();
const mockDestroy = jest.fn();

/** eventTracker 활성 여부 토글 (null 케이스 시뮬레이션용) */
let trackerEnabled = true;

jest.mock('@/lib/event-tracker', () => ({
  get eventTracker() {
    if (!trackerEnabled) return null;
    return { track: mockTrack, destroy: mockDestroy };
  },
}));

// ── 테스트 대상 import (mock 후에) ───────────────────

import { EventTrackerProvider } from '../EventTracker';

// ═══════════════════════════════════════════════════
// 1. 기본 렌더링
// ═══════════════════════════════════════════════════

describe('EventTrackerProvider — 기본 렌더링', () => {
  beforeEach(() => {
    mockPathname.value = '/dashboard';
    trackerEnabled = true;
    jest.clearAllMocks();
  });

  it('렌더링 시 null을 반환한다 (visible UI 없음)', () => {
    const { container } = render(<EventTrackerProvider />);
    expect(container.firstChild).toBeNull();
  });

  it('마운트 시 PAGE_VIEW 이벤트를 트래킹한다', () => {
    render(<EventTrackerProvider />);
    expect(mockTrack).toHaveBeenCalledWith('PAGE_VIEW', { page: '/dashboard' });
  });
});

// ═══════════════════════════════════════════════════
// 2. pathname 분기
// ═══════════════════════════════════════════════════

describe('EventTrackerProvider — pathname 분기', () => {
  beforeEach(() => {
    trackerEnabled = true;
    jest.clearAllMocks();
  });

  it('pathname이 null이면 track을 호출하지 않는다', () => {
    mockPathname.value = null;
    render(<EventTrackerProvider />);
    expect(mockTrack).not.toHaveBeenCalled();
  });

  it('pathname이 있으면 PAGE_VIEW를 트래킹한다', () => {
    mockPathname.value = '/problems';
    render(<EventTrackerProvider />);
    expect(mockTrack).toHaveBeenCalledWith('PAGE_VIEW', { page: '/problems' });
  });
});

// ═══════════════════════════════════════════════════
// 3. pathname 변경 분기
// ═══════════════════════════════════════════════════

describe('EventTrackerProvider — pathname 변경', () => {
  beforeEach(() => {
    mockPathname.value = '/dashboard';
    trackerEnabled = true;
    jest.clearAllMocks();
  });

  it('같은 pathname으로 리렌더링 시 track을 한 번만 호출한다', () => {
    const { rerender } = render(<EventTrackerProvider />);
    expect(mockTrack).toHaveBeenCalledTimes(1);

    // 동일 pathname으로 리렌더링
    act(() => {
      rerender(<EventTrackerProvider />);
    });
    expect(mockTrack).toHaveBeenCalledTimes(1);
  });

  it('pathname이 변경되면 PAGE_VIEW를 다시 트래킹한다', () => {
    const { rerender } = render(<EventTrackerProvider />);
    expect(mockTrack).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledWith('PAGE_VIEW', { page: '/dashboard' });

    // pathname 변경
    mockPathname.value = '/problems';
    act(() => {
      rerender(<EventTrackerProvider />);
    });
    expect(mockTrack).toHaveBeenCalledTimes(2);
    expect(mockTrack).toHaveBeenLastCalledWith('PAGE_VIEW', { page: '/problems' });
  });
});

// ═══════════════════════════════════════════════════
// 4. unmount — destroy 호출
// ═══════════════════════════════════════════════════

describe('EventTrackerProvider — unmount', () => {
  beforeEach(() => {
    mockPathname.value = '/dashboard';
    trackerEnabled = true;
    jest.clearAllMocks();
  });

  it('언마운트 시 eventTracker.destroy를 호출한다', () => {
    const { unmount } = render(<EventTrackerProvider />);
    unmount();
    expect(mockDestroy).toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════════════════════════════
// 5. eventTracker null 케이스 (서버사이드 환경 시뮬레이션)
// ═══════════════════════════════════════════════════

describe('EventTrackerProvider — eventTracker null', () => {
  beforeEach(() => {
    mockPathname.value = '/dashboard';
    jest.clearAllMocks();
  });

  it('eventTracker가 null이어도 렌더링 에러 없이 동작한다', () => {
    trackerEnabled = false;
    expect(() => render(<EventTrackerProvider />)).not.toThrow();
  });

  it('eventTracker가 null이면 track을 호출하지 않는다', () => {
    trackerEnabled = false;
    render(<EventTrackerProvider />);
    expect(mockTrack).not.toHaveBeenCalled();
  });

  it('eventTracker가 null일 때 unmount해도 에러가 없다', () => {
    trackerEnabled = false;
    const { unmount } = render(<EventTrackerProvider />);
    expect(() => unmount()).not.toThrow();
  });
});
