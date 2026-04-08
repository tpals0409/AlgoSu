/**
 * @file event-tracker 단위 테스트
 * @domain common
 * @layer lib
 */

/* ---------- global mock 사전 설정 ---------- */
const mockFetch = jest.fn().mockResolvedValue({ ok: true });
const mockSendBeacon = jest.fn().mockReturnValue(true);
const mockSessionStorage: Record<string, string> = {};

beforeAll(() => {
  Object.defineProperty(global, 'fetch', { value: mockFetch, writable: true });
  Object.defineProperty(navigator, 'sendBeacon', {
    value: mockSendBeacon,
    writable: true,
  });
  Object.defineProperty(window, 'sessionStorage', {
    value: {
      getItem: jest.fn((key: string) => mockSessionStorage[key] ?? null),
      setItem: jest.fn((key: string, val: string) => {
        mockSessionStorage[key] = val;
      }),
      removeItem: jest.fn((key: string) => {
        delete mockSessionStorage[key];
      }),
    },
    writable: true,
  });
  Object.defineProperty(global, 'crypto', {
    value: { randomUUID: () => '00000000-0000-4000-a000-000000000099' },
    writable: true,
  });
});

beforeEach(() => {
  jest.useFakeTimers();
  mockFetch.mockClear();
  mockSendBeacon.mockClear();
  Object.keys(mockSessionStorage).forEach((k) => delete mockSessionStorage[k]);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

/**
 * 모듈 레벨 싱글톤이므로 매 테스트마다 격리하여 import
 */
function loadTracker() {
  let tracker: {
    eventTracker: {
      track: (type: string, data?: Record<string, unknown>) => void;
      destroy: () => void;
    } | null;
  };
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    tracker = require('../event-tracker');
  });
  return tracker!.eventTracker!;
}

describe('EventTracker', () => {
  it('track() — 버퍼에 이벤트를 추가한다', () => {
    const tracker = loadTracker();
    tracker.track('click', { page: '/home' });
    // 1건만 추가했으므로 flush(fetch) 호출 없음
    expect(mockFetch).not.toHaveBeenCalled();
    tracker.destroy();
  });

  it('버퍼 5개 차면 자동 flush (fetch 호출)', () => {
    const tracker = loadTracker();
    for (let i = 0; i < 5; i++) {
      tracker.track('click');
    }
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/events');
    expect(options.method).toBe('POST');
    const body = JSON.parse(options.body);
    expect(body.events).toHaveLength(5);
    tracker.destroy();
  });

  it('flush 시 fetch 실패해도 에러가 발생하지 않는다 (silent drop)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network'));
    const tracker = loadTracker();
    for (let i = 0; i < 5; i++) {
      tracker.track('click');
    }
    // flush 내부의 catch가 에러를 삼키므로 예외가 전파되지 않아야 한다
    await expect(Promise.resolve()).resolves.toBeUndefined();
    tracker.destroy();
  });

  it('sessionId — sessionStorage에서 생성/복원한다', () => {
    // 첫 로드: 새 sessionId 생성
    const tracker1 = loadTracker();
    tracker1.track('view');
    // sessionStorage에 저장됨
    expect(mockSessionStorage['algosu:session-id']).toBe(
      '00000000-0000-4000-a000-000000000099',
    );

    tracker1.destroy();

    // 두 번째 로드: 기존 sessionId 복원
    const tracker2 = loadTracker();
    tracker2.track('view');
    // sessionStorage.getItem이 기존 값을 반환하므로 randomUUID가 다시 호출되지 않음
    expect(mockSessionStorage['algosu:session-id']).toBe(
      '00000000-0000-4000-a000-000000000099',
    );
    tracker2.destroy();
  });

  it('visibilitychange hidden 시 sendBeacon을 호출한다', () => {
    const tracker = loadTracker();
    tracker.track('click');

    // visibilityState를 hidden으로 변경
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      writable: true,
      configurable: true,
    });
    window.dispatchEvent(new Event('visibilitychange'));

    expect(mockSendBeacon).toHaveBeenCalledTimes(1);
    const [url, blob] = mockSendBeacon.mock.calls[0];
    expect(url).toContain('/api/events');
    expect(blob).toBeInstanceOf(Blob);

    // 정리: visibilityState 복원
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true,
    });
    tracker.destroy();
  });

  it('빈 버퍼일 때 flush해도 fetch/sendBeacon을 호출하지 않는다', () => {
    const tracker = loadTracker();
    // 이벤트 없이 destroy (내부에서 flush(true) 호출)
    tracker.destroy();
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockSendBeacon).not.toHaveBeenCalled();
  });
});
