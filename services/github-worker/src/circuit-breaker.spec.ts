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
import { CircuitBreakerManager } from './circuit-breaker';

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
});
