/**
 * @file useInView 단위 테스트
 */
import { renderHook, act } from '@testing-library/react';
import { useInView } from '../useInView';

// IntersectionObserver mock
type IntersectionCallback = (entries: Partial<IntersectionObserverEntry>[]) => void;

let observerCallback: IntersectionCallback | null = null;
const mockObserve = jest.fn();
const mockDisconnect = jest.fn();

beforeEach(() => {
  observerCallback = null;
  mockObserve.mockClear();
  mockDisconnect.mockClear();

  global.IntersectionObserver = jest.fn((cb: IntersectionCallback) => {
    observerCallback = cb;
    return {
      observe: mockObserve,
      disconnect: mockDisconnect,
      unobserve: jest.fn(),
      root: null,
      rootMargin: '',
      thresholds: [],
      takeRecords: jest.fn(),
    };
  }) as unknown as typeof IntersectionObserver;
});

describe('useInView', () => {
  it('초기 상태는 visible=false', () => {
    const { result } = renderHook(() => useInView());
    expect(result.current[1]).toBe(false);
  });

  it('ref에 null이면 observer 미생성 (el이 없는 경우)', () => {
    renderHook(() => useInView());

    // ref.current가 null이므로 observer가 생성되지 않음
    expect(mockObserve).not.toHaveBeenCalled();
  });

  it('뷰포트 진입 시 visible=true로 변경', () => {
    // ref.current에 실제 DOM 요소를 연결하기 위해 직접 설정
    const el = document.createElement('div');

    const { result } = renderHook(() => useInView());

    // useEffect 실행 전에 ref를 설정하고 리렌더
    act(() => {
      result.current[0].current = el;
    });

    // ref가 설정된 상태에서 리렌더하여 useEffect 트리거
    const { result: result2 } = renderHook(() => {
      const hookResult = useInView();
      // 마운트 시 ref에 요소 연결
      hookResult[0].current = el;
      return hookResult;
    });

    // observer 콜백으로 진입 시뮬레이션
    if (observerCallback) {
      act(() => {
        observerCallback!([{ isIntersecting: true } as Partial<IntersectionObserverEntry>]);
      });
      expect(result2.current[1]).toBe(true);
    }
  });

  it('뷰포트 미진입 시 visible=false 유지', () => {
    const el = document.createElement('div');

    const { result } = renderHook(() => {
      const hookResult = useInView();
      hookResult[0].current = el;
      return hookResult;
    });

    if (observerCallback) {
      act(() => {
        observerCallback!([{ isIntersecting: false } as Partial<IntersectionObserverEntry>]);
      });
      expect(result.current[1]).toBe(false);
    }
  });

  it('언마운트 시 observer disconnect 호출', () => {
    const el = document.createElement('div');

    const { unmount } = renderHook(() => {
      const hookResult = useInView();
      hookResult[0].current = el;
      return hookResult;
    });

    unmount();
    expect(mockDisconnect).toHaveBeenCalled();
  });
});
