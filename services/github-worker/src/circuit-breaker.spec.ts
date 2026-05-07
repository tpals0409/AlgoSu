/**
 * @file circuit-breaker.spec.ts -- CircuitBreakerManager 단위 테스트
 * @domain github
 * @layer test
 * @related circuit-breaker.ts
 *
 * Wave A(submission CircuitBreakerService)의 테스트 케이스를 plain-class 환경으로 포팅.
 */

// logger stdout 억제
jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

import { Registry } from 'prom-client';
import {
  CircuitBreakerManager,
  DEFAULT_ERROR_FILTER,
  FILTERED_BUSINESS_STATUS,
} from './circuit-breaker';

describe('CircuitBreakerManager', () => {
  let manager: CircuitBreakerManager;
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry();
    manager = new CircuitBreakerManager(registry);
  });

  afterEach(() => {
    manager.shutdown();
  });

  // ─── 1. CLOSED -- 정상 호출 ────────────────────────────────────
  describe('CLOSED -- 정상 호출', () => {
    it('action 성공 시 결과를 반환한다', async () => {
      const action = jest.fn().mockResolvedValue(42);
      manager.createBreaker('test-ok', action);

      const breaker = manager.getBreaker('test-ok')!;
      const result = await breaker.fire();

      expect(result).toBe(42);
      expect(action).toHaveBeenCalledTimes(1);
    });

    it('getState가 CLOSED를 반환한다', () => {
      manager.createBreaker('test-state', jest.fn().mockResolvedValue('ok'));

      expect(manager.getState('test-state')).toBe('CLOSED');
    });
  });

  // ─── 2. CLOSED -> OPEN 전이 ────────────────────────────────────
  describe('CLOSED -> OPEN 전이', () => {
    it('volumeThreshold 이상 연속 실패 시 OPEN 전이 후 reject', async () => {
      const action = jest.fn().mockRejectedValue(new Error('fail'));
      manager.createBreaker('test-open', action, {
        volumeThreshold: 1,
        errorThresholdPercentage: 1,
        resetTimeout: 30_000,
        rollingCountTimeout: 10_000,
        rollingCountBuckets: 1,
        timeout: false,
      });

      const breaker = manager.getBreaker('test-open')!;

      for (let i = 0; i < 3; i++) {
        try {
          await breaker.fire();
        } catch {
          /* expected */
        }
      }

      expect(manager.getState('test-open')).toBe('OPEN');
      await expect(breaker.fire()).rejects.toThrow();
    });
  });

  // ─── 3. OPEN -> HALF_OPEN 전이 ──────────────────────────────────
  describe('OPEN -> HALF_OPEN 전이', () => {
    it('resetTimeout 경과 후 요청을 허용한다', async () => {
      jest.useFakeTimers();

      let shouldFail = true;
      const action = jest.fn().mockImplementation(() => {
        if (shouldFail) return Promise.reject(new Error('fail'));
        return Promise.resolve('recovered');
      });

      manager.createBreaker('test-half', action, {
        volumeThreshold: 1,
        errorThresholdPercentage: 1,
        resetTimeout: 100,
        rollingCountTimeout: 10_000,
        rollingCountBuckets: 1,
        timeout: false,
      });

      const breaker = manager.getBreaker('test-half')!;

      for (let i = 0; i < 3; i++) {
        try { await breaker.fire(); } catch { /* expected */ }
      }
      expect(manager.getState('test-half')).toBe('OPEN');

      shouldFail = false;
      jest.advanceTimersByTime(200);

      const result = await breaker.fire();
      expect(result).toBe('recovered');

      jest.useRealTimers();
    });
  });

  // ─── 4. HALF_OPEN -> CLOSED 전이 ───────────────────────────────
  describe('HALF_OPEN -> CLOSED', () => {
    it('성공 시 CLOSED 복귀', async () => {
      jest.useFakeTimers();

      let shouldFail = true;
      const action = jest.fn().mockImplementation(() => {
        if (shouldFail) return Promise.reject(new Error('fail'));
        return Promise.resolve('ok');
      });

      manager.createBreaker('test-recover', action, {
        volumeThreshold: 1,
        errorThresholdPercentage: 1,
        resetTimeout: 100,
        rollingCountTimeout: 10_000,
        rollingCountBuckets: 1,
        timeout: false,
      });

      const breaker = manager.getBreaker('test-recover')!;
      for (let i = 0; i < 3; i++) {
        try { await breaker.fire(); } catch { /* expected */ }
      }

      shouldFail = false;
      jest.advanceTimersByTime(200);
      await breaker.fire();

      expect(manager.getState('test-recover')).toBe('CLOSED');
      jest.useRealTimers();
    });
  });

  // ─── 5. HALF_OPEN -> OPEN 전이 ─────────────────────────────────
  describe('HALF_OPEN -> OPEN', () => {
    it('실패 시 다시 OPEN', async () => {
      jest.useFakeTimers();

      const action = jest.fn().mockRejectedValue(new Error('fail'));
      manager.createBreaker('test-reopen', action, {
        volumeThreshold: 1,
        errorThresholdPercentage: 1,
        resetTimeout: 100,
        rollingCountTimeout: 10_000,
        rollingCountBuckets: 1,
        timeout: false,
      });

      const breaker = manager.getBreaker('test-reopen')!;
      for (let i = 0; i < 3; i++) {
        try { await breaker.fire(); } catch { /* expected */ }
      }
      expect(manager.getState('test-reopen')).toBe('OPEN');

      jest.advanceTimersByTime(200);
      try { await breaker.fire(); } catch { /* expected */ }
      expect(manager.getState('test-reopen')).toBe('OPEN');

      jest.useRealTimers();
    });
  });

  // ─── 6. fallback 동작 ────────────────────────────────────────
  describe('fallback 동작', () => {
    it('CB OPEN 시 fallback 함수가 호출된다', async () => {
      const action = jest.fn().mockRejectedValue(new Error('fail'));
      const fallback = jest.fn().mockReturnValue('fallback-value');

      manager.createBreaker('test-fb', action, {
        volumeThreshold: 1,
        errorThresholdPercentage: 1,
        resetTimeout: 30_000,
        rollingCountTimeout: 10_000,
        rollingCountBuckets: 1,
        timeout: false,
        fallback,
      });

      const breaker = manager.getBreaker('test-fb')!;
      for (let i = 0; i < 3; i++) {
        await breaker.fire();
      }

      const result = await breaker.fire();
      expect(result).toBe('fallback-value');
      expect(fallback).toHaveBeenCalled();
    });
  });

  // ─── 7. Prometheus 메트릭 업데이트 ─────────────────────────────
  describe('Prometheus 메트릭', () => {
    it('state gauge가 초기값 0(CLOSED)으로 설정된다', async () => {
      manager.createBreaker('test-metrics', jest.fn().mockResolvedValue(1));

      const metrics = await registry.getMetricsAsJSON();
      const stateMetric = metrics.find(
        (m) => m.name === 'algosu_github_worker_circuit_breaker_state',
      );

      expect(stateMetric).toBeDefined();
      expect(stateMetric!.values).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ labels: { name: 'test-metrics' }, value: 0 }),
        ]),
      );
    });

    it('성공 시 requests_total(success) 카운터가 증가한다', async () => {
      const action = jest.fn().mockResolvedValue('ok');
      manager.createBreaker('test-cnt', action);
      const breaker = manager.getBreaker('test-cnt')!;

      await breaker.fire();

      const metrics = await registry.getMetricsAsJSON();
      const reqMetric = metrics.find(
        (m) => m.name === 'algosu_github_worker_circuit_breaker_requests_total',
      );

      expect(reqMetric).toBeDefined();
      expect(reqMetric!.values).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            labels: { name: 'test-cnt', result: 'success' },
            value: 1,
          }),
        ]),
      );
    });

    it('실패 시 failures_total 카운터가 증가한다', async () => {
      const action = jest.fn().mockRejectedValue(new Error('fail'));
      manager.createBreaker('test-fail-cnt', action, {
        volumeThreshold: 100,
        timeout: false,
      });
      const breaker = manager.getBreaker('test-fail-cnt')!;

      try { await breaker.fire(); } catch { /* expected */ }

      const metrics = await registry.getMetricsAsJSON();
      const failMetric = metrics.find(
        (m) => m.name === 'algosu_github_worker_circuit_breaker_failures_total',
      );

      expect(failMetric).toBeDefined();
      expect(failMetric!.values).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            labels: { name: 'test-fail-cnt' },
            value: 1,
          }),
        ]),
      );
    });

    it('OPEN 후 reject 시 requests_total(reject) 카운터가 증가한다', async () => {
      const action = jest.fn().mockRejectedValue(new Error('fail'));
      manager.createBreaker('test-reject-cnt', action, {
        volumeThreshold: 1,
        errorThresholdPercentage: 1,
        resetTimeout: 30_000,
        rollingCountTimeout: 10_000,
        rollingCountBuckets: 1,
        timeout: false,
      });
      const breaker = manager.getBreaker('test-reject-cnt')!;

      // OPEN으로 전이
      for (let i = 0; i < 3; i++) {
        try { await breaker.fire(); } catch { /* expected */ }
      }

      // OPEN 상태에서 추가 요청 → reject
      try { await breaker.fire(); } catch { /* expected */ }

      const metrics = await registry.getMetricsAsJSON();
      const reqMetric = metrics.find(
        (m) => m.name === 'algosu_github_worker_circuit_breaker_requests_total',
      );
      const rejectVal = (reqMetric?.values ?? []).find(
        (v) => v.labels?.['name'] === 'test-reject-cnt' && v.labels?.['result'] === 'reject',
      )?.value;

      expect(rejectVal).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── 8. getBreaker / getState — 미등록 ─────────────────────────
  describe('미등록 breaker 조회', () => {
    it('getBreaker가 undefined를 반환한다', () => {
      expect(manager.getBreaker('nonexistent')).toBeUndefined();
    });

    it('getState가 undefined를 반환한다', () => {
      expect(manager.getState('nonexistent')).toBeUndefined();
    });
  });

  // ─── 9. timeout 이벤트 메트릭 중복 방지 ───────────────────────
  describe('timeout 이벤트 메트릭 중복 방지', () => {
    it('timeout 발생 시 requests_total은 timeout 1건만 증가하고 failure는 증가하지 않는다', async () => {
      const action = jest.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve('late'), 100)),
      );
      manager.createBreaker('test-timeout', action, {
        timeout: 10,
        volumeThreshold: 100,
        errorThresholdPercentage: 99,
        resetTimeout: 30_000,
        rollingCountTimeout: 10_000,
        rollingCountBuckets: 1,
      });

      const breaker = manager.getBreaker('test-timeout')!;
      try {
        await breaker.fire();
      } catch {
        /* 예상된 timeout */
      }

      const metrics = await registry.getMetricsAsJSON();
      const requestsMetric = metrics.find(
        (m) => m.name === 'algosu_github_worker_circuit_breaker_requests_total',
      );
      const timeoutVal = (requestsMetric?.values ?? []).find(
        (v) => v.labels?.['name'] === 'test-timeout' && v.labels?.['result'] === 'timeout',
      )?.value;
      const failureVal = (requestsMetric?.values ?? []).find(
        (v) => v.labels?.['name'] === 'test-timeout' && v.labels?.['result'] === 'failure',
      )?.value;

      expect(timeoutVal).toBe(1);
      expect(failureVal).toBeUndefined();
    });
  });

  // ─── 10. shutdown — 타이머 정리 ───────────────────────────────
  describe('shutdown — 타이머 정리', () => {
    it('등록된 모든 breaker.shutdown()을 호출하고 Map을 비운다', () => {
      const action = jest.fn().mockResolvedValue('ok');
      manager.createBreaker('shutdown-1', action);
      manager.createBreaker('shutdown-2', action);

      const b1 = manager.getBreaker('shutdown-1')!;
      const b2 = manager.getBreaker('shutdown-2')!;
      const spy1 = jest.spyOn(b1, 'shutdown');
      const spy2 = jest.spyOn(b2, 'shutdown');

      manager.shutdown();

      expect(spy1).toHaveBeenCalledTimes(1);
      expect(spy2).toHaveBeenCalledTimes(1);
      expect(manager.getBreaker('shutdown-1')).toBeUndefined();
      expect(manager.getBreaker('shutdown-2')).toBeUndefined();
    });

    it('shutdown 실패한 breaker는 Map에 보존하고 성공한 것만 제거한다 (retry 가능)', () => {
      const action = jest.fn().mockResolvedValue('ok');
      manager.createBreaker('shutdown-fail', action);
      manager.createBreaker('shutdown-ok', action);

      const bFail = manager.getBreaker('shutdown-fail')!;
      const bOk = manager.getBreaker('shutdown-ok')!;
      jest.spyOn(bFail, 'shutdown').mockImplementation(() => {
        throw new Error('shutdown boom');
      });
      const spyOk = jest.spyOn(bOk, 'shutdown');

      expect(() => manager.shutdown()).not.toThrow();
      expect(spyOk).toHaveBeenCalledTimes(1);
      expect(manager.getBreaker('shutdown-ok')).toBeUndefined();
      expect(manager.getBreaker('shutdown-fail')).toBe(bFail);
    });
  });

  // ─── 11. errorFilter — 비즈니스 4xx 화이트리스트만 CB 제외 (Sprint 135 D7) ────────────
  describe('errorFilter — 비즈니스 4xx 화이트리스트만 CB 제외', () => {
    /** status 첨부된 HTTP-style 에러 헬퍼 */
    function httpError(message: string, status: number): Error & { status: number } {
      const err = new Error(message) as Error & { status: number };
      err.status = status;
      return err;
    }

    describe('FILTERED_BUSINESS_STATUS 화이트리스트 정의', () => {
      it('404/410/422만 포함하고 400/401/403/408/429는 제외한다', () => {
        // Critic 2차 P1: 인증/rate-limit/timeout은 CB 보호 대상 (회로 OPEN 트리거 유지)
        // Critic 3차 P2: 400은 DTO/contract regression 시그널 → CB 보호 대상
        expect(FILTERED_BUSINESS_STATUS.has(404)).toBe(true);
        expect(FILTERED_BUSINESS_STATUS.has(410)).toBe(true);
        expect(FILTERED_BUSINESS_STATUS.has(422)).toBe(true);
        // 보호 대상 (CB failure로 카운트되어야 함)
        expect(FILTERED_BUSINESS_STATUS.has(400)).toBe(false);
        expect(FILTERED_BUSINESS_STATUS.has(401)).toBe(false);
        expect(FILTERED_BUSINESS_STATUS.has(403)).toBe(false);
        expect(FILTERED_BUSINESS_STATUS.has(408)).toBe(false);
        expect(FILTERED_BUSINESS_STATUS.has(429)).toBe(false);
      });
    });

    describe('DEFAULT_ERROR_FILTER 단위 동작', () => {
      it('화이트리스트 status(404/410/422)는 true 반환 (CB failure 제외)', () => {
        expect(DEFAULT_ERROR_FILTER(httpError('not found', 404))).toBe(true);
        expect(DEFAULT_ERROR_FILTER(httpError('gone', 410))).toBe(true);
        expect(DEFAULT_ERROR_FILTER(httpError('unprocessable', 422))).toBe(true);
      });

      it('화이트리스트 외 4xx(400/401/403/408/429)는 false 반환 (CB failure 카운트)', () => {
        // Critic 2차 P1: 인증 outage / rate limit / timeout은 회로 보호 대상
        // Critic 3차 P2: 400은 contract regression 보호 (dead dependency hammering 방지)
        expect(DEFAULT_ERROR_FILTER(httpError('bad req', 400))).toBe(false);
        expect(DEFAULT_ERROR_FILTER(httpError('unauthorized', 401))).toBe(false);
        expect(DEFAULT_ERROR_FILTER(httpError('forbidden', 403))).toBe(false);
        expect(DEFAULT_ERROR_FILTER(httpError('req timeout', 408))).toBe(false);
        expect(DEFAULT_ERROR_FILTER(httpError('rate limit', 429))).toBe(false);
        expect(DEFAULT_ERROR_FILTER(httpError('teapot', 418))).toBe(false);
        expect(DEFAULT_ERROR_FILTER(httpError('misc 4xx', 499))).toBe(false);
      });

      it('5xx status는 false 반환 (CB failure 카운트)', () => {
        expect(DEFAULT_ERROR_FILTER(httpError('server', 500))).toBe(false);
        expect(DEFAULT_ERROR_FILTER(httpError('bad gw', 502))).toBe(false);
        expect(DEFAULT_ERROR_FILTER(httpError('unavail', 503))).toBe(false);
      });

      it('status 없는 에러(네트워크/타임아웃)는 false 반환', () => {
        expect(DEFAULT_ERROR_FILTER(new Error('ENETUNREACH'))).toBe(false);
        expect(DEFAULT_ERROR_FILTER(null)).toBe(false);
        expect(DEFAULT_ERROR_FILTER(undefined)).toBe(false);
        expect(DEFAULT_ERROR_FILTER({})).toBe(false);
      });

      it('경계값 400 미만/500 이상은 false', () => {
        expect(DEFAULT_ERROR_FILTER(httpError('redirect', 399))).toBe(false);
        expect(DEFAULT_ERROR_FILTER(httpError('boundary', 500))).toBe(false);
      });
    });

    it('404(화이트리스트) 영구 발생 시 CLOSED 유지 + filtered 메트릭만 증가', async () => {
      const action = jest.fn().mockRejectedValue(httpError('not found', 404));
      manager.createBreaker('test-404-filtered', action, {
        volumeThreshold: 1,
        errorThresholdPercentage: 1,
        resetTimeout: 30_000,
        rollingCountTimeout: 10_000,
        rollingCountBuckets: 1,
        timeout: false,
      });

      const breaker = manager.getBreaker('test-404-filtered')!;

      // 5번 404 throw → errorFilter true → success 이벤트(error 인자) → filtered 메트릭
      for (let i = 0; i < 5; i++) {
        try {
          await breaker.fire();
        } catch {
          /* 호출자에는 throw 전파되나 CB 통계엔 미반영 */
        }
      }

      expect(manager.getState('test-404-filtered')).toBe('CLOSED');

      // 메트릭: filtered 라벨 5건, success/failure는 미증가 (Critic 2차 P2)
      const metrics = await registry.getMetricsAsJSON();
      const reqMetric = metrics.find(
        (m) => m.name === 'algosu_github_worker_circuit_breaker_requests_total',
      );
      const filteredVal = (reqMetric?.values ?? []).find(
        (v) =>
          v.labels?.['name'] === 'test-404-filtered' && v.labels?.['result'] === 'filtered',
      )?.value;
      const successVal = (reqMetric?.values ?? []).find(
        (v) =>
          v.labels?.['name'] === 'test-404-filtered' && v.labels?.['result'] === 'success',
      )?.value;
      const failureVal = (reqMetric?.values ?? []).find(
        (v) =>
          v.labels?.['name'] === 'test-404-filtered' && v.labels?.['result'] === 'failure',
      )?.value;
      expect(filteredVal).toBe(5);
      expect(successVal).toBeUndefined();
      expect(failureVal).toBeUndefined();
    });

    it('400(화이트리스트 외) 영구 발생 시 OPEN 전이 — contract regression 보호', async () => {
      // Critic 3차 P2: DTO/contract drift(header missing, validation drift) 시 dead dependency hammering 차단
      const action = jest.fn().mockRejectedValue(httpError('bad request', 400));
      manager.createBreaker('test-400-open', action, {
        volumeThreshold: 1,
        errorThresholdPercentage: 1,
        resetTimeout: 30_000,
        rollingCountTimeout: 10_000,
        rollingCountBuckets: 1,
        timeout: false,
      });

      const breaker = manager.getBreaker('test-400-open')!;
      for (let i = 0; i < 3; i++) {
        try { await breaker.fire(); } catch { /* expected */ }
      }

      expect(manager.getState('test-400-open')).toBe('OPEN');
    });

    it('401(화이트리스트 외) 영구 발생 시 OPEN 전이 — 인증 outage 보호', async () => {
      // Critic 2차 P1: X-Internal-Key 회전/오설정으로 영구 401 발생 시 CB가 OPEN되어야 함
      const action = jest.fn().mockRejectedValue(httpError('unauthorized', 401));
      manager.createBreaker('test-401-open', action, {
        volumeThreshold: 1,
        errorThresholdPercentage: 1,
        resetTimeout: 30_000,
        rollingCountTimeout: 10_000,
        rollingCountBuckets: 1,
        timeout: false,
      });

      const breaker = manager.getBreaker('test-401-open')!;
      for (let i = 0; i < 3; i++) {
        try { await breaker.fire(); } catch { /* expected */ }
      }

      expect(manager.getState('test-401-open')).toBe('OPEN');
    });

    it('403(화이트리스트 외) 영구 발생 시 OPEN 전이 — 권한 outage 보호', async () => {
      const action = jest.fn().mockRejectedValue(httpError('forbidden', 403));
      manager.createBreaker('test-403-open', action, {
        volumeThreshold: 1,
        errorThresholdPercentage: 1,
        resetTimeout: 30_000,
        rollingCountTimeout: 10_000,
        rollingCountBuckets: 1,
        timeout: false,
      });

      const breaker = manager.getBreaker('test-403-open')!;
      for (let i = 0; i < 3; i++) {
        try { await breaker.fire(); } catch { /* expected */ }
      }

      expect(manager.getState('test-403-open')).toBe('OPEN');
    });

    it('429(화이트리스트 외) 영구 발생 시 OPEN 전이 — overload 보호', async () => {
      const action = jest.fn().mockRejectedValue(httpError('rate limit', 429));
      manager.createBreaker('test-429-open', action, {
        volumeThreshold: 1,
        errorThresholdPercentage: 1,
        resetTimeout: 30_000,
        rollingCountTimeout: 10_000,
        rollingCountBuckets: 1,
        timeout: false,
      });

      const breaker = manager.getBreaker('test-429-open')!;
      for (let i = 0; i < 3; i++) {
        try { await breaker.fire(); } catch { /* expected */ }
      }

      expect(manager.getState('test-429-open')).toBe('OPEN');
    });

    it('5xx 에러는 정상 CB failure로 카운트되어 OPEN 전이', async () => {
      const action = jest.fn().mockRejectedValue(httpError('upstream down', 503));
      manager.createBreaker('test-5xx-open', action, {
        volumeThreshold: 1,
        errorThresholdPercentage: 1,
        resetTimeout: 30_000,
        rollingCountTimeout: 10_000,
        rollingCountBuckets: 1,
        timeout: false,
      });

      const breaker = manager.getBreaker('test-5xx-open')!;

      for (let i = 0; i < 3; i++) {
        try { await breaker.fire(); } catch { /* expected */ }
      }

      expect(manager.getState('test-5xx-open')).toBe('OPEN');
    });

    it('status 없는 에러(네트워크/타임아웃)는 정상 CB failure로 카운트', async () => {
      const action = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
      manager.createBreaker('test-network-open', action, {
        volumeThreshold: 1,
        errorThresholdPercentage: 1,
        resetTimeout: 30_000,
        rollingCountTimeout: 10_000,
        rollingCountBuckets: 1,
        timeout: false,
      });

      const breaker = manager.getBreaker('test-network-open')!;

      for (let i = 0; i < 3; i++) {
        try { await breaker.fire(); } catch { /* expected */ }
      }

      expect(manager.getState('test-network-open')).toBe('OPEN');
    });

    it('filtered 카운터가 success 카운터와 분리됨 (혼합 시나리오)', async () => {
      // Critic 2차 P2: errorFilter 통과 시 success 이벤트 → result Error 인스턴스 분기 검증
      let mode: 'ok' | '404' = 'ok';
      const action = jest.fn().mockImplementation(() => {
        if (mode === 'ok') return Promise.resolve('value');
        return Promise.reject(httpError('not found', 404));
      });

      manager.createBreaker('test-mixed', action, {
        volumeThreshold: 100,
        errorThresholdPercentage: 99,
        resetTimeout: 30_000,
        rollingCountTimeout: 10_000,
        rollingCountBuckets: 1,
        timeout: false,
      });

      const breaker = manager.getBreaker('test-mixed')!;

      // 2번 정상 성공
      for (let i = 0; i < 2; i++) {
        await breaker.fire();
      }

      // 3번 404 (filtered)
      mode = '404';
      for (let i = 0; i < 3; i++) {
        try { await breaker.fire(); } catch { /* expected */ }
      }

      const metrics = await registry.getMetricsAsJSON();
      const reqMetric = metrics.find(
        (m) => m.name === 'algosu_github_worker_circuit_breaker_requests_total',
      );
      const successVal = (reqMetric?.values ?? []).find(
        (v) => v.labels?.['name'] === 'test-mixed' && v.labels?.['result'] === 'success',
      )?.value;
      const filteredVal = (reqMetric?.values ?? []).find(
        (v) => v.labels?.['name'] === 'test-mixed' && v.labels?.['result'] === 'filtered',
      )?.value;
      const failureVal = (reqMetric?.values ?? []).find(
        (v) => v.labels?.['name'] === 'test-mixed' && v.labels?.['result'] === 'failure',
      )?.value;

      expect(successVal).toBe(2);
      expect(filteredVal).toBe(3);
      expect(failureVal).toBeUndefined();
    });

    // ─── Sprint 141 — WeakSet 마커 패턴 정확 분류 (instanceof Error 휴리스틱 대체) ───
    describe('WeakSet 마커 패턴 — Sprint 141 백포팅', () => {
      it('plain object throw + errorFilter 통과 시 filtered만 카운트되고 success는 미증가', async () => {
        // 이전 instanceof Error 휴리스틱은 plain object throw 시 success로 잘못 분류했다.
        // WeakSet 마커 패턴은 wrapper에서 마커 추가 → success 핸들러가 마커 발견 후 skip.
        const plainErr = { status: 404, message: 'not found' };
        const action = jest.fn().mockRejectedValue(plainErr);

        manager.createBreaker('test-plain-404', action, {
          volumeThreshold: 1,
          errorThresholdPercentage: 1,
          resetTimeout: 30_000,
          rollingCountTimeout: 10_000,
          rollingCountBuckets: 1,
          timeout: false,
        });

        const breaker = manager.getBreaker('test-plain-404')!;
        for (let i = 0; i < 3; i++) {
          try { await breaker.fire(); } catch { /* expected */ }
        }

        const metrics = await registry.getMetricsAsJSON();
        const reqMetric = metrics.find(
          (m) => m.name === 'algosu_github_worker_circuit_breaker_requests_total',
        );
        const filteredVal = (reqMetric?.values ?? []).find(
          (v) => v.labels?.['name'] === 'test-plain-404' && v.labels?.['result'] === 'filtered',
        )?.value;
        const successVal = (reqMetric?.values ?? []).find(
          (v) => v.labels?.['name'] === 'test-plain-404' && v.labels?.['result'] === 'success',
        )?.value;

        expect(filteredVal).toBe(3);
        expect(successVal).toBeUndefined();
      });

      it('동일 객체가 filtered reject 후 정상 resolve로 재사용될 때 markers.delete로 success 정확 카운트', async () => {
        // P2 회귀 보호 (Critic 1차) — markers.delete(result) 누락 시 동일 객체 재사용에서 success skip되는 회귀.
        // 시나리오: 같은 plain object를 (1) filtered reject → 마커 추가, (2) 정상 resolve → 마커 삭제 + success 카운트
        const sharedObj = { status: 404, ref: 'shared' };
        let mode: 'reject' | 'resolve' = 'reject';
        const action = jest.fn().mockImplementation(() => {
          if (mode === 'reject') return Promise.reject(sharedObj);
          return Promise.resolve(sharedObj);
        });

        manager.createBreaker('test-marker-delete', action, {
          volumeThreshold: 100,
          errorThresholdPercentage: 99,
          resetTimeout: 30_000,
          rollingCountTimeout: 10_000,
          rollingCountBuckets: 1,
          timeout: false,
        });

        const breaker = manager.getBreaker('test-marker-delete')!;

        // 1) filtered reject — 마커 추가
        try { await breaker.fire(); } catch { /* expected */ }

        // 2) 정상 resolve로 같은 객체 반환 — markers.delete가 동작해야 success 카운트 정확
        mode = 'resolve';
        await breaker.fire();
        // 3) 다시 정상 resolve — 마커 삭제 후이므로 또 success 카운트
        await breaker.fire();

        const metrics = await registry.getMetricsAsJSON();
        const reqMetric = metrics.find(
          (m) => m.name === 'algosu_github_worker_circuit_breaker_requests_total',
        );
        const filteredVal = (reqMetric?.values ?? []).find(
          (v) => v.labels?.['name'] === 'test-marker-delete' && v.labels?.['result'] === 'filtered',
        )?.value;
        const successVal = (reqMetric?.values ?? []).find(
          (v) => v.labels?.['name'] === 'test-marker-delete' && v.labels?.['result'] === 'success',
        )?.value;

        expect(filteredVal).toBe(1);
        // markers.delete(result) 미동작 시 첫 resolve가 마커 hit → skip → successVal=1 (실패)
        // 정상 동작 시 첫 resolve에서 마커 삭제 → success 카운트 + 두 번째 resolve도 success → 2
        expect(successVal).toBe(2);
      });

      it('Error 인스턴스를 정상 resolve로 반환 시 success로 카운트됨', async () => {
        // 이전 instanceof Error 휴리스틱은 이를 filtered로 잘못 분류했다.
        // WeakSet 마커 패턴은 wrapper 미경유이므로 마커 부재 → success 정확.
        const errorAsValue = new Error('this is a value, not a thrown error');
        const action = jest.fn().mockResolvedValue(errorAsValue);

        manager.createBreaker('test-error-as-value', action);
        const breaker = manager.getBreaker('test-error-as-value')!;

        await breaker.fire();

        const metrics = await registry.getMetricsAsJSON();
        const reqMetric = metrics.find(
          (m) => m.name === 'algosu_github_worker_circuit_breaker_requests_total',
        );
        const successVal = (reqMetric?.values ?? []).find(
          (v) => v.labels?.['name'] === 'test-error-as-value' && v.labels?.['result'] === 'success',
        )?.value;
        const filteredVal = (reqMetric?.values ?? []).find(
          (v) => v.labels?.['name'] === 'test-error-as-value' && v.labels?.['result'] === 'filtered',
        )?.value;

        expect(successVal).toBe(1);
        expect(filteredVal).toBeUndefined();
      });
    });

    it('호출자가 errorFilter override 시 default가 아닌 호출자 함수가 사용됨', async () => {
      // override: 모든 에러를 filtered (= CB failure 미카운트)
      const customFilter = jest.fn().mockReturnValue(true);
      const action = jest.fn().mockRejectedValue(httpError('upstream down', 503));

      manager.createBreaker('test-override', action, {
        volumeThreshold: 1,
        errorThresholdPercentage: 1,
        resetTimeout: 30_000,
        rollingCountTimeout: 10_000,
        rollingCountBuckets: 1,
        timeout: false,
        errorFilter: customFilter,
      });

      const breaker = manager.getBreaker('test-override')!;
      for (let i = 0; i < 3; i++) {
        try { await breaker.fire(); } catch { /* expected */ }
      }

      // customFilter가 모두 true → OPEN 전이 안 됨 (default였다면 5xx로 OPEN)
      expect(manager.getState('test-override')).toBe('CLOSED');
      expect(customFilter).toHaveBeenCalled();
    });
  });
});
