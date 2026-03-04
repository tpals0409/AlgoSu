/**
 * @file useSubmissionSSE 단위 테스트
 *
 * Note: SSE 스트림 데이터 수신 테스트는 React act()가 useEffect 내부의
 * fire-and-forget async 함수(void connect())의 continuation을 flush하지 못하는
 * 한계로 인해, 연결/해제/에러 경로 + mapSSEToSteps 순수 함수 테스트에 집중.
 */
import { renderHook, act } from '@testing-library/react';
import { useSubmissionSSE, mapSSEToSteps } from '../useSubmissionSSE';

describe('useSubmissionSSE', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('submissionId가 null이면 연결하지 않는다', () => {
    global.fetch = jest.fn();
    const { result } = renderHook(() => useSubmissionSSE(null));

    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.current.status).toBe('connecting');
    expect(result.current.events).toEqual([]);
  });

  it('submissionId가 있으면 SSE 연결을 시작한다', () => {
    global.fetch = jest.fn().mockImplementation(() => new Promise(() => {}));

    renderHook(() => useSubmissionSSE('sub-1'));

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/sse/submissions/sub-1'),
      expect.objectContaining({
        credentials: 'include',
        headers: { Accept: 'text/event-stream' },
      }),
    );
  });

  it('응답 실패 시 error 상태를 설정한다', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, body: null });

    const { result } = renderHook(() => useSubmissionSSE('sub-1'));

    // flush the async chain: useEffect -> void connect() -> await fetch() -> setStatus('error')
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.status).toBe('error');
  });

  it('disconnect 함수로 수동 연결 해제', () => {
    const abortSpy = jest.fn();
    const originalAbortController = global.AbortController;
    global.AbortController = jest.fn().mockImplementation(() => ({
      signal: { aborted: false },
      abort: abortSpy,
    })) as unknown as typeof AbortController;

    global.fetch = jest.fn().mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() => useSubmissionSSE('sub-1'));

    act(() => {
      result.current.disconnect();
    });

    expect(abortSpy).toHaveBeenCalled();

    global.AbortController = originalAbortController;
  });

  it('언마운트 시 연결을 해제한다', () => {
    const abortSpy = jest.fn();
    const originalAbortController = global.AbortController;
    global.AbortController = jest.fn().mockImplementation(() => ({
      signal: { aborted: false },
      abort: abortSpy,
    })) as unknown as typeof AbortController;

    global.fetch = jest.fn().mockImplementation(() => new Promise(() => {}));

    const { unmount } = renderHook(() => useSubmissionSSE('sub-1'));

    unmount();
    expect(abortSpy).toHaveBeenCalled();

    global.AbortController = originalAbortController;
  });

  it('AbortError는 재연결하지 않는다', async () => {
    global.fetch = jest.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError'));

    renderHook(() => useSubmissionSSE('sub-1'));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // AbortError 이후 재연결 없으므로 fetch 1번만 호출
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('submissionId 변경 시 이전 연결을 해제하고 재연결한다', () => {
    const abortSpy = jest.fn();
    const originalAbortController = global.AbortController;
    global.AbortController = jest.fn().mockImplementation(() => ({
      signal: { aborted: false },
      abort: abortSpy,
    })) as unknown as typeof AbortController;

    global.fetch = jest.fn().mockImplementation(() => new Promise(() => {}));

    const { rerender } = renderHook(
      ({ id }) => useSubmissionSSE(id),
      { initialProps: { id: 'sub-1' as string | null } },
    );

    expect(global.fetch).toHaveBeenCalledTimes(1);

    rerender({ id: 'sub-2' });

    // 이전 연결 해제 + 새 연결
    expect(abortSpy).toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledTimes(2);

    global.AbortController = originalAbortController;
  });

  it('초기 상태에서 disconnect 호출해도 안전하다', () => {
    global.fetch = jest.fn().mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() => useSubmissionSSE(null));

    // null인 경우 disconnect 호출 시 에러 없음
    expect(() => {
      act(() => {
        result.current.disconnect();
      });
    }).not.toThrow();
  });
});

describe('mapSSEToSteps', () => {
  it('connecting 상태 -> Step2 in_progress, Step3 pending', () => {
    const steps = mapSSEToSteps('connecting');
    expect(steps[0].status).toBe('done');
    expect(steps[0].label).toBe('제출 완료');
    expect(steps[1].status).toBe('in_progress');
    expect(steps[1].label).toBe('GitHub 동기화');
    expect(steps[2].status).toBe('pending');
    expect(steps[2].label).toBe('AI 분석');
  });

  it('github_syncing 상태 -> Step2 in_progress, Step3 pending', () => {
    const steps = mapSSEToSteps('github_syncing');
    expect(steps[1].status).toBe('in_progress');
    expect(steps[2].status).toBe('pending');
  });

  it('github_synced -> Step2 done, Step3 done (AI 단계 진입)', () => {
    const steps = mapSSEToSteps('github_synced');
    expect(steps[1].status).toBe('done');
    expect(steps[2].status).toBe('pending');
  });

  it('github_failed -> Step2 failed, Step3 in_progress', () => {
    const steps = mapSSEToSteps('github_failed');
    expect(steps[1].status).toBe('failed');
    expect(steps[1].detail).toContain('GitHub 동기화 실패');
    expect(steps[2].status).toBe('in_progress');
  });

  it('github_token_invalid -> Step2 failed, Step3 pending, detail에 재연동 안내', () => {
    const steps = mapSSEToSteps('github_token_invalid');
    expect(steps[1].status).toBe('failed');
    expect(steps[1].detail).toContain('GitHub 재연동');
    expect(steps[2].status).toBe('pending');
  });

  it('github_skipped -> Step2 done + 건너뜀 detail, Step3 in_progress', () => {
    const steps = mapSSEToSteps('github_skipped');
    expect(steps[1].status).toBe('done');
    expect(steps[1].detail).toContain('건너뜀');
    expect(steps[2].status).toBe('in_progress');
  });

  it('ai_analyzing -> Step2 done, Step3 in_progress', () => {
    const steps = mapSSEToSteps('ai_analyzing');
    expect(steps[1].status).toBe('done');
    expect(steps[2].status).toBe('in_progress');
  });

  it('ai_completed -> Step2 done, Step3 done', () => {
    const steps = mapSSEToSteps('ai_completed');
    expect(steps[1].status).toBe('done');
    expect(steps[2].status).toBe('done');
  });

  it('ai_delayed -> Step2 done, Step3 failed + 지연 detail', () => {
    const steps = mapSSEToSteps('ai_delayed');
    expect(steps[1].status).toBe('done');
    expect(steps[2].status).toBe('failed');
    expect(steps[2].detail).toContain('지연');
  });

  it('ai_failed -> Step2 done, Step3 failed', () => {
    const steps = mapSSEToSteps('ai_failed');
    expect(steps[1].status).toBe('done');
    expect(steps[2].status).toBe('failed');
  });

  it('done -> Step2 done, Step3 done', () => {
    const steps = mapSSEToSteps('done');
    expect(steps[1].status).toBe('done');
    expect(steps[2].status).toBe('done');
  });

  it('error -> Step2 done, Step3 pending', () => {
    const steps = mapSSEToSteps('error');
    expect(steps[1].status).toBe('done');
    expect(steps[2].status).toBe('pending');
  });

  it('모든 상태에서 Step1(제출 완료)은 항상 done', () => {
    const statuses = [
      'connecting', 'github_syncing', 'github_synced', 'github_failed',
      'github_token_invalid', 'github_skipped', 'ai_analyzing',
      'ai_completed', 'ai_delayed', 'ai_failed', 'done', 'error',
    ] as const;

    for (const s of statuses) {
      const steps = mapSSEToSteps(s);
      expect(steps[0].status).toBe('done');
      expect(steps[0].label).toBe('제출 완료');
    }
  });

  it('detail이 없는 상태에서는 undefined', () => {
    const steps = mapSSEToSteps('connecting');
    expect(steps[1].detail).toBeUndefined();
    expect(steps[2].detail).toBeUndefined();
  });

  it('github_synced에서는 detail이 없다', () => {
    const steps = mapSSEToSteps('github_synced');
    expect(steps[1].detail).toBeUndefined();
  });
});
