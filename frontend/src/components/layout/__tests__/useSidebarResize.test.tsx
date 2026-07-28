/**
 * @file useSidebarResize hook tests (Sprint 265 #12)
 * 노션식 사이드바 리사이즈·접기 훅: clamp / localStorage 영속화 / 드래그 검증.
 */

import { renderHook, act, fireEvent } from '@testing-library/react';
import {
  useSidebarResize,
  clampWidth,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_COLLAPSED_WIDTH,
} from '../useSidebarResize';

const WIDTH_KEY = 'algosu:appSidebarWidth';
const COLLAPSED_KEY = 'algosu:appSidebarCollapsed';

beforeEach(() => {
  window.localStorage.clear();
  // jsdom은 PointerEvent 미구현 → MouseEvent 기반 최소 폴리필(clientX 전달용)
  if (typeof window.PointerEvent === 'undefined') {
    // @ts-expect-error jsdom 테스트 전용 최소 폴리필
    window.PointerEvent = class PointerEvent extends MouseEvent {};
  }
});

/** onResizeStart에 넘길 최소 pointer 이벤트 스텁. */
function pointerStub(): React.PointerEvent<HTMLElement> {
  return { preventDefault: jest.fn() } as unknown as React.PointerEvent<HTMLElement>;
}

describe('clampWidth', () => {
  it('범위 내 값은 그대로 반환한다', () => {
    expect(clampWidth(300)).toBe(300);
  });

  it('최소치 미만은 MIN으로 클램프한다', () => {
    expect(clampWidth(50)).toBe(SIDEBAR_MIN_WIDTH);
  });

  it('최대치 초과는 MAX로 클램프한다', () => {
    expect(clampWidth(9999)).toBe(SIDEBAR_MAX_WIDTH);
  });
});

describe('useSidebarResize', () => {
  it('기본 폭은 220px, 접힘 아님', () => {
    const { result } = renderHook(() => useSidebarResize());
    expect(result.current.width).toBe(SIDEBAR_DEFAULT_WIDTH);
    expect(result.current.collapsed).toBe(false);
    expect(result.current.effectiveWidth).toBe(SIDEBAR_DEFAULT_WIDTH);
  });

  it('저장된 폭을 localStorage에서 복원한다', () => {
    window.localStorage.setItem(WIDTH_KEY, '300');
    const { result } = renderHook(() => useSidebarResize());
    expect(result.current.width).toBe(300);
  });

  it('저장된 폭이 범위를 벗어나면 클램프해 복원한다', () => {
    window.localStorage.setItem(WIDTH_KEY, '9999');
    const { result } = renderHook(() => useSidebarResize());
    expect(result.current.width).toBe(SIDEBAR_MAX_WIDTH);
  });

  it('저장된 접힘 상태를 복원한다', () => {
    window.localStorage.setItem(COLLAPSED_KEY, 'true');
    const { result } = renderHook(() => useSidebarResize());
    expect(result.current.collapsed).toBe(true);
    expect(result.current.effectiveWidth).toBe(SIDEBAR_COLLAPSED_WIDTH);
  });

  it('접힘 토글은 상태를 뒤집고 localStorage에 저장한다', () => {
    const { result } = renderHook(() => useSidebarResize());
    act(() => result.current.toggleCollapsed());
    expect(result.current.collapsed).toBe(true);
    expect(window.localStorage.getItem(COLLAPSED_KEY)).toBe('true');
    act(() => result.current.toggleCollapsed());
    expect(result.current.collapsed).toBe(false);
    expect(window.localStorage.getItem(COLLAPSED_KEY)).toBe('false');
  });

  it('드래그로 폭을 조절하고 pointerup에서 저장한다 — 범위 초과 시 클램프', () => {
    const { result } = renderHook(() => useSidebarResize());

    act(() => result.current.onResizeStart(pointerStub()));
    expect(result.current.dragging).toBe(true);

    act(() => {
      fireEvent.pointerMove(window, { clientX: 300 });
    });
    expect(result.current.width).toBe(300);

    // 최대치(400) 초과 → 클램프
    act(() => {
      fireEvent.pointerMove(window, { clientX: 1000 });
    });
    expect(result.current.width).toBe(SIDEBAR_MAX_WIDTH);

    act(() => {
      fireEvent.pointerUp(window);
    });
    expect(result.current.dragging).toBe(false);
    expect(window.localStorage.getItem(WIDTH_KEY)).toBe(String(SIDEBAR_MAX_WIDTH));
  });

  it('접힘 시 effectiveWidth는 접힘 폭이지만 width는 유지된다', () => {
    window.localStorage.setItem(WIDTH_KEY, '320');
    const { result } = renderHook(() => useSidebarResize());
    act(() => result.current.toggleCollapsed());
    expect(result.current.effectiveWidth).toBe(SIDEBAR_COLLAPSED_WIDTH);
    expect(result.current.width).toBe(320);
  });
});
