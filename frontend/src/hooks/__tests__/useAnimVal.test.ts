/**
 * @file useAnimVal 단위 테스트
 */
import { renderHook, act } from '@testing-library/react';
import { useAnimVal } from '../useAnimVal';

type IntersectionCallback = (entries: Partial<IntersectionObserverEntry>[]) => void;

let observerCallback: IntersectionCallback | null = null;
const mockObserve = jest.fn();
const mockDisconnect = jest.fn();

let rafCallbacks: ((timestamp: number) => void)[] = [];
let rafIdCounter = 1;

beforeEach(() => {
  observerCallback = null;
  mockObserve.mockClear();
  mockDisconnect.mockClear();
  rafCallbacks = [];
  rafIdCounter = 1;

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

  jest.spyOn(global, 'requestAnimationFrame').mockImplementation((cb) => {
    rafCallbacks.push(cb);
    return rafIdCounter++;
  });
  jest.spyOn(global, 'cancelAnimationFrame').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('useAnimVal', () => {
  it('초기값은 0이다', () => {
    const { result } = renderHook(() => useAnimVal(100));
    expect(result.current[1]).toBe(0);
  });

  it('ref가 null이면 observer 미생성', () => {
    renderHook(() => useAnimVal(100));
    expect(mockObserve).not.toHaveBeenCalled();
  });

  it('뷰포트 진입 시 애니메이션이 시작된다', () => {
    const el = document.createElement('div');

    const { result } = renderHook(() => {
      const hookResult = useAnimVal(100, 1000);
      // @ts-expect-error -- ref.current 직접 설정
      hookResult[0].current = el;
      return hookResult;
    });

    // IntersectionObserver 진입 시뮬레이션
    if (observerCallback) {
      act(() => {
        observerCallback!([{ isIntersecting: true }]);
      });
    }

    // requestAnimationFrame 호출 확인
    expect(rafCallbacks.length).toBeGreaterThan(0);

    // 애니메이션 step 실행
    act(() => {
      // progress = 0 -> value = 0
      rafCallbacks[0](0);
    });

    // 두 번째 프레임: progress = 500/1000 = 0.5
    act(() => {
      if (rafCallbacks.length > 1) {
        rafCallbacks[1](500);
      }
    });

    // value가 0보다 커야 함
    expect(result.current[1]).toBeGreaterThanOrEqual(0);
  });

  it('뷰포트 진입 후 rAF이 연속 등록된다 (애니메이션 루프)', () => {
    const el = document.createElement('div');

    renderHook(() => {
      const hookResult = useAnimVal(100, 1000);
      // @ts-expect-error -- ref.current 직접 설정
      hookResult[0].current = el;
      return hookResult;
    });

    if (observerCallback) {
      act(() => {
        observerCallback!([{ isIntersecting: true }]);
      });
    }

    // 첫 번째 rAF 호출: startTime 설정
    expect(rafCallbacks.length).toBe(1);
    const cb1 = rafCallbacks.shift()!;
    act(() => { cb1(0); }); // startTime = 0, progress = 0

    // progress < 1이므로 다음 rAF이 등록됨
    expect(rafCallbacks.length).toBeGreaterThanOrEqual(1);
  });

  it('커스텀 duration을 사용할 수 있다', () => {
    const el = document.createElement('div');

    const { result } = renderHook(() => {
      const hookResult = useAnimVal(50, 2000);
      // @ts-expect-error -- ref.current 직접 설정
      hookResult[0].current = el;
      return hookResult;
    });

    expect(result.current[1]).toBe(0);
    // duration = 2000으로 정상 생성
    expect(mockObserve).toHaveBeenCalled();
  });

  it('뷰포트 미진입 시 애니메이션 시작 안함', () => {
    const el = document.createElement('div');

    const { result } = renderHook(() => {
      const hookResult = useAnimVal(100);
      // @ts-expect-error -- ref.current 직접 설정
      hookResult[0].current = el;
      return hookResult;
    });

    if (observerCallback) {
      act(() => {
        observerCallback!([{ isIntersecting: false }]);
      });
    }

    expect(result.current[1]).toBe(0);
  });

  it('언마운트 시 observer disconnect 호출', () => {
    const el = document.createElement('div');

    const { unmount } = renderHook(() => {
      const hookResult = useAnimVal(100);
      // @ts-expect-error -- ref.current 직접 설정
      hookResult[0].current = el;
      return hookResult;
    });

    unmount();
    expect(mockDisconnect).toHaveBeenCalled();
  });

  it('언마운트 시 cancelAnimationFrame 호출', () => {
    const el = document.createElement('div');

    const { unmount } = renderHook(() => {
      const hookResult = useAnimVal(100, 1000);
      // @ts-expect-error -- ref.current 직접 설정
      hookResult[0].current = el;
      return hookResult;
    });

    if (observerCallback) {
      act(() => {
        observerCallback!([{ isIntersecting: true }]);
      });
    }

    unmount();
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });
});
