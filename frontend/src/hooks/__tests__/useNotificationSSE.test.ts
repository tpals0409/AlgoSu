/**
 * @file useNotificationSSE 단위 테스트
 *
 * Note: SSE 스트림 데이터 수신 테스트는 React act()가 useEffect 내부의
 * fire-and-forget async 함수의 continuation을 flush하지 못하는 한계로 인해,
 * 연결/해제/에러/재연결 경로 테스트에 집중.
 */
import { renderHook, act } from '@testing-library/react';
import { useNotificationSSE } from '../useNotificationSSE';

describe('useNotificationSSE', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('enabled=false이면 연결하지 않는다', () => {
    const onNotification = jest.fn();
    global.fetch = jest.fn();

    renderHook(() => useNotificationSSE(false, onNotification));

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('enabled=true이면 SSE 연결을 시작한다', () => {
    const onNotification = jest.fn();
    global.fetch = jest.fn().mockImplementation(() => new Promise(() => {}));

    renderHook(() => useNotificationSSE(true, onNotification));

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/sse/notifications'),
      expect.objectContaining({
        credentials: 'include',
        headers: { Accept: 'text/event-stream' },
      }),
    );
  });

  it('응답 실패 시 재연결을 스케줄한다', async () => {
    jest.useFakeTimers();
    const onNotification = jest.fn();

    global.fetch = jest.fn().mockResolvedValue({ ok: false, body: null });

    renderHook(() => useNotificationSSE(true, onNotification));

    // fetch 호출 후 async continuation 처리
    await act(async () => {
      for (let i = 0; i < 20; i++) await Promise.resolve();
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);

    // 재연결 대기(3초) 후 다시 fetch
    await act(async () => {
      jest.advanceTimersByTime(3000);
      for (let i = 0; i < 20; i++) await Promise.resolve();
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  it('언마운트 시 연결을 해제한다', () => {
    const onNotification = jest.fn();
    const abortSpy = jest.fn();

    const originalAbortController = global.AbortController;
    global.AbortController = jest.fn().mockImplementation(() => ({
      signal: { aborted: false },
      abort: abortSpy,
    })) as unknown as typeof AbortController;

    global.fetch = jest.fn().mockImplementation(() => new Promise(() => {}));

    const { unmount } = renderHook(() =>
      useNotificationSSE(true, onNotification),
    );

    unmount();
    expect(abortSpy).toHaveBeenCalled();

    global.AbortController = originalAbortController;
  });

  it('네트워크 에러 시 재연결을 시도한다', async () => {
    jest.useFakeTimers();
    const onNotification = jest.fn();

    global.fetch = jest.fn()
      .mockRejectedValueOnce(new Error('네트워크 에러'))
      .mockImplementation(() => new Promise(() => {}));

    renderHook(() => useNotificationSSE(true, onNotification));

    await act(async () => {
      for (let i = 0; i < 20; i++) await Promise.resolve();
    });

    await act(async () => {
      jest.advanceTimersByTime(3000);
      for (let i = 0; i < 20; i++) await Promise.resolve();
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  it('AbortError는 재연결하지 않는다', async () => {
    const onNotification = jest.fn();
    const abortError = new DOMException('Aborted', 'AbortError');

    global.fetch = jest.fn().mockRejectedValue(abortError);

    renderHook(() => useNotificationSSE(true, onNotification));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('최대 재연결 횟수(5) 초과 시 중단한다', async () => {
    jest.useFakeTimers();
    const onNotification = jest.fn();

    global.fetch = jest.fn().mockResolvedValue({ ok: false, body: null });

    renderHook(() => useNotificationSSE(true, onNotification));

    // 초기 연결 + 5회 재연결 시도
    for (let i = 0; i < 6; i++) {
      await act(async () => {
        jest.advanceTimersByTime(3000 * Math.pow(2, i));
        for (let j = 0; j < 20; j++) await Promise.resolve();
      });
    }

    const callCount = (global.fetch as jest.Mock).mock.calls.length;

    // 최대 횟수 초과 후 추가 재연결 없음
    await act(async () => {
      jest.advanceTimersByTime(200000);
      for (let i = 0; i < 20; i++) await Promise.resolve();
    });

    expect(global.fetch).toHaveBeenCalledTimes(callCount);
    jest.useRealTimers();
  });

  it('enabled false -> true 전환 시 연결한다', () => {
    const onNotification = jest.fn();
    global.fetch = jest.fn().mockImplementation(() => new Promise(() => {}));

    const { rerender } = renderHook(
      ({ enabled }) => useNotificationSSE(enabled, onNotification),
      { initialProps: { enabled: false } },
    );

    expect(global.fetch).not.toHaveBeenCalled();

    rerender({ enabled: true });

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('enabled true -> false 전환 시 연결을 해제한다', () => {
    const onNotification = jest.fn();
    const abortSpy = jest.fn();

    const originalAbortController = global.AbortController;
    global.AbortController = jest.fn().mockImplementation(() => ({
      signal: { aborted: false },
      abort: abortSpy,
    })) as unknown as typeof AbortController;

    global.fetch = jest.fn().mockImplementation(() => new Promise(() => {}));

    const { rerender } = renderHook(
      ({ enabled }) => useNotificationSSE(enabled, onNotification),
      { initialProps: { enabled: true } },
    );

    rerender({ enabled: false });
    expect(abortSpy).toHaveBeenCalled();

    global.AbortController = originalAbortController;
  });
});
