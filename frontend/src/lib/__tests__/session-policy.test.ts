/**
 * @file session-policy.test.ts
 * @domain auth
 * @layer lib
 *
 * Sprint 71-2R: 세션 정책 모듈 단위 테스트.
 * 성공/실패/스키마 불일치 케이스에서 fallback 동작을 검증한다.
 */

import {
  DEFAULT_SESSION_POLICY,
  fetchSessionPolicy,
  type ClientSessionPolicy,
} from '@/lib/session-policy';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

function okJson(data: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
  });
}

function httpError(status: number) {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve({}),
  });
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe('DEFAULT_SESSION_POLICY', () => {
  it('필수 필드를 모두 positive number로 포함한다', () => {
    const keys: (keyof ClientSessionPolicy)[] = [
      'accessTokenTtlMs',
      'heartbeatIntervalMs',
      'sessionTimeoutMs',
      'refreshThresholdMs',
    ];
    for (const key of keys) {
      expect(typeof DEFAULT_SESSION_POLICY[key]).toBe('number');
      expect(DEFAULT_SESSION_POLICY[key]).toBeGreaterThan(0);
      expect(Number.isFinite(DEFAULT_SESSION_POLICY[key])).toBe(true);
    }
  });

  it('sessionTimeoutMs는 heartbeatIntervalMs보다 크다 (만료 판정이 최소 1회 heartbeat 뒤에 와야 함)', () => {
    expect(DEFAULT_SESSION_POLICY.sessionTimeoutMs).toBeGreaterThan(
      DEFAULT_SESSION_POLICY.heartbeatIntervalMs,
    );
  });

  it('frozen object — 런타임 변조 차단', () => {
    expect(Object.isFrozen(DEFAULT_SESSION_POLICY)).toBe(true);
  });
});

describe('fetchSessionPolicy', () => {
  it('정상 응답 시 서버 정책을 반환한다', async () => {
    const serverPolicy = {
      accessTokenTtlMs: 2 * 60 * 60 * 1000,
      heartbeatIntervalMs: 10 * 60 * 1000,
      sessionTimeoutMs: 125 * 60 * 1000,
      refreshThresholdMs: 60 * 60 * 1000,
    };
    mockFetch.mockReturnValue(okJson(serverPolicy));

    const result = await fetchSessionPolicy();
    expect(result).toEqual(serverPolicy);
  });

  it('{ data: {...} } 래퍼 응답을 언래핑한다', async () => {
    const serverPolicy = {
      accessTokenTtlMs: 7200000,
      heartbeatIntervalMs: 600000,
      sessionTimeoutMs: 7500000,
      refreshThresholdMs: 3600000,
    };
    mockFetch.mockReturnValue(okJson({ data: serverPolicy }));

    const result = await fetchSessionPolicy();
    expect(result).toEqual(serverPolicy);
  });

  it('네트워크 실패 시 DEFAULT_SESSION_POLICY를 반환한다', async () => {
    mockFetch.mockRejectedValue(new Error('network down'));

    const result = await fetchSessionPolicy();
    expect(result).toEqual(DEFAULT_SESSION_POLICY);
  });

  it('HTTP 5xx 응답 시 DEFAULT_SESSION_POLICY를 반환한다', async () => {
    mockFetch.mockReturnValue(httpError(503));

    const result = await fetchSessionPolicy();
    expect(result).toEqual(DEFAULT_SESSION_POLICY);
  });

  it('HTTP 404 응답 시 DEFAULT_SESSION_POLICY를 반환한다 (엔드포인트 미배포)', async () => {
    mockFetch.mockReturnValue(httpError(404));

    const result = await fetchSessionPolicy();
    expect(result).toEqual(DEFAULT_SESSION_POLICY);
  });

  it('필드 누락 응답 시 DEFAULT_SESSION_POLICY를 반환한다', async () => {
    mockFetch.mockReturnValue(
      okJson({ accessTokenTtlMs: 7200000, heartbeatIntervalMs: 600000 }),
    );

    const result = await fetchSessionPolicy();
    expect(result).toEqual(DEFAULT_SESSION_POLICY);
  });

  it('필드 타입 불일치(string) 시 DEFAULT_SESSION_POLICY를 반환한다', async () => {
    mockFetch.mockReturnValue(
      okJson({
        accessTokenTtlMs: '2h',
        heartbeatIntervalMs: 600000,
        sessionTimeoutMs: 7500000,
        refreshThresholdMs: 3600000,
      }),
    );

    const result = await fetchSessionPolicy();
    expect(result).toEqual(DEFAULT_SESSION_POLICY);
  });

  it('음수 필드 시 DEFAULT_SESSION_POLICY를 반환한다', async () => {
    mockFetch.mockReturnValue(
      okJson({
        accessTokenTtlMs: -1,
        heartbeatIntervalMs: 600000,
        sessionTimeoutMs: 7500000,
        refreshThresholdMs: 3600000,
      }),
    );

    const result = await fetchSessionPolicy();
    expect(result).toEqual(DEFAULT_SESSION_POLICY);
  });

  it('0 필드 시 DEFAULT_SESSION_POLICY를 반환한다', async () => {
    mockFetch.mockReturnValue(
      okJson({
        accessTokenTtlMs: 7200000,
        heartbeatIntervalMs: 0,
        sessionTimeoutMs: 7500000,
        refreshThresholdMs: 3600000,
      }),
    );

    const result = await fetchSessionPolicy();
    expect(result).toEqual(DEFAULT_SESSION_POLICY);
  });

  it('null 응답 body 시 DEFAULT_SESSION_POLICY를 반환한다', async () => {
    mockFetch.mockReturnValue(okJson(null));

    const result = await fetchSessionPolicy();
    expect(result).toEqual(DEFAULT_SESSION_POLICY);
  });

  it('JSON parse 실패 시 DEFAULT_SESSION_POLICY를 반환한다', async () => {
    mockFetch.mockReturnValue(
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.reject(new Error('invalid json')),
      }),
    );

    const result = await fetchSessionPolicy();
    expect(result).toEqual(DEFAULT_SESSION_POLICY);
  });

  it('credentials 없이 호출한다 (공개 엔드포인트, 리다이렉트 우회)', async () => {
    const serverPolicy = {
      accessTokenTtlMs: 7200000,
      heartbeatIntervalMs: 600000,
      sessionTimeoutMs: 7500000,
      refreshThresholdMs: 3600000,
    };
    mockFetch.mockReturnValue(okJson(serverPolicy));

    await fetchSessionPolicy();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.credentials).toBeUndefined();
    expect(opts.method).toBe('GET');
  });

  it('/auth/session-policy 경로로 호출한다', async () => {
    mockFetch.mockReturnValue(
      okJson({
        accessTokenTtlMs: 7200000,
        heartbeatIntervalMs: 600000,
        sessionTimeoutMs: 7500000,
        refreshThresholdMs: 3600000,
      }),
    );

    await fetchSessionPolicy();

    const [url] = mockFetch.mock.calls[0];
    expect(String(url)).toContain('/auth/session-policy');
  });
});
