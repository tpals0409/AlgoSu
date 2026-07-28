/**
 * @file Desktop sidebar resize + collapse hook
 * @domain common
 * @layer hook
 * @related AppLayout
 *
 * 노션식 사이드바 폭 드래그 조절 + 접기 토글.
 * 폭은 [MIN, MAX] 범위로 clamp, 폭·접힘 상태 모두 localStorage 영속화.
 * SSR 하이드레이션 불일치 방지를 위해 저장값은 mount 후 로드.
 */

'use client';

import { useCallback, useEffect, useState, type PointerEvent as ReactPointerEvent } from 'react';

// ─── RESIZE CONSTANTS ───────────────────────

export const SIDEBAR_MIN_WIDTH = 180;
export const SIDEBAR_MAX_WIDTH = 400;
export const SIDEBAR_DEFAULT_WIDTH = 220;
export const SIDEBAR_COLLAPSED_WIDTH = 56;

const WIDTH_STORAGE_KEY = 'algosu:appSidebarWidth';
const COLLAPSED_STORAGE_KEY = 'algosu:appSidebarCollapsed';

/** 폭을 [MIN, MAX] 범위로 제한한다. */
export const clampWidth = (w: number): number =>
  Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, w));

export interface SidebarResizeState {
  /** 현재 펼침 폭(px). 접힘 여부와 무관하게 마지막 리사이즈 폭을 유지한다. */
  readonly width: number;
  /** 접힘 상태. */
  readonly collapsed: boolean;
  /** 드래그 진행 중 여부(트랜지션 일시 비활성화용). */
  readonly dragging: boolean;
  /** 데스크톱 사이드바가 실제 차지하는 폭(px) — 접힘 시 축소값. */
  readonly effectiveWidth: number;
  /** 접힘 토글. */
  readonly toggleCollapsed: () => void;
  /** 리사이즈 핸들 pointerdown 핸들러. */
  readonly onResizeStart: (e: ReactPointerEvent<HTMLElement>) => void;
}

/** 저장된 폭을 mount 후 복원한다. */
function useRestoredWidth(setWidth: (w: number) => void): void {
  useEffect(() => {
    const saved = window.localStorage.getItem(WIDTH_STORAGE_KEY);
    if (saved === null) return;
    const parsed = Number(saved);
    if (!Number.isNaN(parsed)) setWidth(clampWidth(parsed));
  }, [setWidth]);
}

/** 저장된 접힘 상태를 mount 후 복원한다. */
function useRestoredCollapsed(setCollapsed: (c: boolean) => void): void {
  useEffect(() => {
    const saved = window.localStorage.getItem(COLLAPSED_STORAGE_KEY);
    if (saved !== null) setCollapsed(saved === 'true');
  }, [setCollapsed]);
}

/**
 * 데스크톱 사이드바 리사이즈·접기 상태를 관리한다.
 * 사이드바 좌측이 뷰포트 x=0 → 드래그 중 clientX ≈ 폭.
 */
export function useSidebarResize(): SidebarResizeState {
  const [width, setWidth] = useState(SIDEBAR_DEFAULT_WIDTH);
  const [collapsed, setCollapsed] = useState(false);
  const [dragging, setDragging] = useState(false);

  useRestoredWidth(setWidth);
  useRestoredCollapsed(setCollapsed);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(COLLAPSED_STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  const onResizeStart = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    e.preventDefault();
    setDragging(true);
    const onMove = (ev: PointerEvent): void => setWidth(clampWidth(ev.clientX));
    const onUp = (): void => {
      setDragging(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setWidth((w) => {
        window.localStorage.setItem(WIDTH_STORAGE_KEY, String(w));
        return w;
      });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, []);

  const effectiveWidth = collapsed ? SIDEBAR_COLLAPSED_WIDTH : width;

  return { width, collapsed, dragging, effectiveWidth, toggleCollapsed, onResizeStart };
}
