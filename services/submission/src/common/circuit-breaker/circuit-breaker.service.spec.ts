/**
 * @file circuit-breaker.service.spec.ts -- CircuitBreakerService 단위 테스트
 * @domain common
 * @layer test
 * @related circuit-breaker.service.ts
 */

import { Test, TestingModule } from '@nestjs/testing';
import { Registry } from 'prom-client';
import { CircuitBreakerService } from './circuit-breaker.service';
import { METRICS_REGISTRY } from './circuit-breaker.constants';

describe('CircuitBreakerService', () => {
  let service: CircuitBreakerService;
  let registry: Registry;

  beforeEach(async () => {
    registry = new Registry();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CircuitBreakerService,
        { provide: METRICS_REGISTRY, useValue: registry },
      ],
    }).compile();

    service = module.get<CircuitBreakerService>(CircuitBreakerService);
  });

  // ─── 1. CLOSED -- 정상 호출 ────────────────────────────────────
  describe('CLOSED -- 정상 호출', () => {
    it('action 성공 시 결과를 반환한다', async () => {
      const action = jest.fn().mockResolvedValue(42);
      service.createBreaker('test-ok', action);

      const breaker = service.getBreaker('test-ok')!;
      const result = await breaker.fire();

      expect(result).toBe(42);
      expect(action).toHaveBeenCalledTimes(1);
    });

    it('getState가 CLOSED를 반환한��', async () => {
      const action = jest.fn().mockResolvedValue('ok');
      service.createBreaker('test-state', action);

      expect(service.getState('test-state')).toBe('CLOSED');
    });
  });

  // ─── 2. CLOSED -> OPEN 전이 ────────────────────────────────────
  describe('CLOSED -> OPEN 전이', () => {
    it('volumeThreshold 이상 연속 실패 시 OPEN 전이 후 reject', async () => {
      const action = jest.fn().mockRejectedValue(new Error('fail'));
      service.createBreaker('test-open', action, {
        volumeThreshold: 1,
        errorThresholdPercentage: 1,
        resetTimeout: 30_000,
        rollingCountTimeout: 10_000,
        rollingCountBuckets: 1,
      });

      const breaker = service.getBreaker('test-open')!;

      // 실패를 쌓아서 OPEN 유도
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.fire();
        } catch {
          // expected
        }
      }

      expect(service.getState('test-open')).toBe('OPEN');

      // OPEN 상태에서 추가 요청은 reject
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

      service.createBreaker('test-half', action, {
        volumeThreshold: 1,
        errorThresholdPercentage: 1,
        resetTimeout: 100,
        rollingCountTimeout: 10_000,
        rollingCountBuckets: 1,
        timeout: false,
      });

      const breaker = service.getBreaker('test-half')!;

      // OPEN으로 전이
      for (let i = 0; i < 3; i++) {
        try { await breaker.fire(); } catch { /* expected */ }
      }
      expect(service.getState('test-half')).toBe('OPEN');

      // 성공 모드로 전환 + resetTimeout 경과
      shouldFail = false;
      jest.advanceTimersByTime(200);

      // HALF_OPEN에서 성공
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

      service.createBreaker('test-recover', action, {
        volumeThreshold: 1,
        errorThresholdPercentage: 1,
        resetTimeout: 100,
        rollingCountTimeout: 10_000,
        rollingCountBuckets: 1,
        timeout: false,
      });

      const breaker = service.getBreaker('test-recover')!;

      for (let i = 0; i < 3; i++) {
        try { await breaker.fire(); } catch { /* expected */ }
      }

      shouldFail = false;
      jest.advanceTimersByTime(200);
      await breaker.fire();

      expect(service.getState('test-recover')).toBe('CLOSED');

      jest.useRealTimers();
    });
  });

  // ─── 5. HALF_OPEN -> OPEN 전이 ─────��───────────────────────────
  describe('HALF_OPEN -> OPEN', () => {
    it('실패 시 다시 OPEN', async () => {
      jest.useFakeTimers();

      const action = jest.fn().mockRejectedValue(new Error('fail'));

      service.createBreaker('test-reopen', action, {
        volumeThreshold: 1,
        errorThresholdPercentage: 1,
        resetTimeout: 100,
        rollingCountTimeout: 10_000,
        rollingCountBuckets: 1,
        timeout: false,
      });

      const breaker = service.getBreaker('test-reopen')!;

      // OPEN으로 전이
      for (let i = 0; i < 3; i++) {
        try { await breaker.fire(); } catch { /* expected */ }
      }
      expect(service.getState('test-reopen')).toBe('OPEN');

      // resetTimeout 경과 -> HALF_OPEN
      jest.advanceTimersByTime(200);

      // HALF_OPEN에서 실패 -> 다시 OPEN
      try { await breaker.fire(); } catch { /* expected */ }
      expect(service.getState('test-reopen')).toBe('OPEN');

      jest.useRealTimers();
    });
  });

  // ─── 6. fallback 동작 ───────────��───────────────────────────��──
  describe('fallback 동��', () => {
    it('CB OPEN 시 fallback 함수가 호���된다', async () => {
      const action = jest.fn().mockRejectedValue(new Error('fail'));
      const fallback = jest.fn().mockReturnValue('fallback-value');

      service.createBreaker('test-fb', action, {
        volumeThreshold: 1,
        errorThresholdPercentage: 1,
        resetTimeout: 30_000,
        rollingCountTimeout: 10_000,
        rollingCountBuckets: 1,
        fallback,
      });

      const breaker = service.getBreaker('test-fb')!;

      // OPEN으로 전이
      for (let i = 0; i < 3; i++) {
        await breaker.fire(); // fallback이 에러를 ���수
      }

      // OPEN 상태에서 fallback 반환
      const result = await breaker.fire();
      expect(result).toBe('fallback-value');
      expect(fallback).toHaveBeenCalled();
    });
  });

  // ─── 7. Prometheus 메트릭 업데이트 ───────���─────────────────────
  describe('Prometheus ���트릭', () => {
    it('state gauge가 초기값 0(CLOSED)으로 설정된다', async () => {
      service.createBreaker('test-metrics', jest.fn().mockResolvedValue(1));

      const metrics = await registry.getMetricsAsJSON();
      const stateMetric = metrics.find(
        (m) => m.name === 'algosu_submission_circuit_breaker_state',
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
      service.createBreaker('test-cnt', action);
      const breaker = service.getBreaker('test-cnt')!;

      await breaker.fire();

      const metrics = await registry.getMetricsAsJSON();
      const reqMetric = metrics.find(
        (m) => m.name === 'algosu_submission_circuit_breaker_requests_total',
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

    it('실패 �� failures_total 카운터가 증가한다', async () => {
      const action = jest.fn().mockRejectedValue(new Error('fail'));
      service.createBreaker('test-fail-cnt', action, {
        volumeThreshold: 100,
        timeout: false,
      });
      const breaker = service.getBreaker('test-fail-cnt')!;

      try { await breaker.fire(); } catch { /* expected */ }

      const metrics = await registry.getMetricsAsJSON();
      const failMetric = metrics.find(
        (m) => m.name === 'algosu_submission_circuit_breaker_failures_total',
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
  });

  // ─── 8. getBreaker / getState — 미등록 ─────────────────────────
  describe('미등록 breaker 조회', () => {
    it('getBreaker가 undefined를 반환한다', () => {
      expect(service.getBreaker('nonexistent')).toBeUndefined();
    });

    it('getState가 undefined를 반환���다', () => {
      expect(service.getState('nonexistent')).toBeUndefined();
    });
  });

  // ─── 9. timeout 이벤트 메트릭 중복 방지 (P2) ──────────────────
  describe('timeout 이벤트 메트릭 중복 방지', () => {
    it('timeout 발생 시 requests_total은 timeout 1건만 증가하고 failure는 증가하지 않는다', async () => {
      // opossum은 timeout 시 'timeout' + 'failure' 이벤트를 모두 emit함
      // 실제 timeout을 유발하기 위해 timeout=10ms, action은 100ms 지연
      const action = jest.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve('late'), 100)),
      );
      service.createBreaker('test-timeout', action, {
        timeout: 10,
        volumeThreshold: 100,
        errorThresholdPercentage: 99,
        resetTimeout: 30_000,
        rollingCountTimeout: 10_000,
        rollingCountBuckets: 1,
      });

      const breaker = service.getBreaker('test-timeout')!;

      try {
        await breaker.fire();
      } catch {
        /* 예상된 timeout */
      }

      // 메트릭 검증: requests_total{result="timeout"}는 1, result="failure"는 0
      const metrics = await registry.getMetricsAsJSON();
      const requestsMetric = metrics.find(
        (m) => m.name === 'algosu_submission_circuit_breaker_requests_total',
      );
      const timeoutVal = (requestsMetric?.values ?? []).find(
        (v) => v.labels?.['name'] === 'test-timeout' && v.labels?.['result'] === 'timeout',
      )?.value;
      const failureVal = (requestsMetric?.values ?? []).find(
        (v) => v.labels?.['name'] === 'test-timeout' && v.labels?.['result'] === 'failure',
      )?.value;

      expect(timeoutVal).toBe(1);
      expect(failureVal).toBeUndefined(); // failure는 카운트되지 않아야 함
    });
  });

  // ─── 10. onModuleDestroy — 타이머 누수 방지 (P2) ────────────
  describe('onModuleDestroy — 타이머 정리', () => {
    it('등록된 모든 breaker.shutdown()을 호출하고 Map을 비운다', () => {
      const action = jest.fn().mockResolvedValue('ok');
      service.createBreaker('shutdown-1', action);
      service.createBreaker('shutdown-2', action);

      const b1 = service.getBreaker('shutdown-1')!;
      const b2 = service.getBreaker('shutdown-2')!;
      const spy1 = jest.spyOn(b1, 'shutdown');
      const spy2 = jest.spyOn(b2, 'shutdown');

      service.onModuleDestroy();

      expect(spy1).toHaveBeenCalledTimes(1);
      expect(spy2).toHaveBeenCalledTimes(1);
      expect(service.getBreaker('shutdown-1')).toBeUndefined();
      expect(service.getBreaker('shutdown-2')).toBeUndefined();
    });

    it('shutdown 중 일부 실패해도 나머지는 정리된다', () => {
      const action = jest.fn().mockResolvedValue('ok');
      service.createBreaker('shutdown-fail', action);
      service.createBreaker('shutdown-ok', action);

      const bFail = service.getBreaker('shutdown-fail')!;
      const bOk = service.getBreaker('shutdown-ok')!;
      jest.spyOn(bFail, 'shutdown').mockImplementation(() => {
        throw new Error('shutdown boom');
      });
      const spyOk = jest.spyOn(bOk, 'shutdown');

      expect(() => service.onModuleDestroy()).not.toThrow();
      expect(spyOk).toHaveBeenCalledTimes(1);
      expect(service.getBreaker('shutdown-ok')).toBeUndefined();
    });
  });
});
