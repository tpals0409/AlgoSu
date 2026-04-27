/**
 * @file circuit-breaker.service.spec.ts -- CircuitBreakerService 단위 테스트
 * @domain common
 * @layer test
 * @related circuit-breaker.service.ts
 */

import { Test, TestingModule } from '@nestjs/testing';
import { Registry } from 'prom-client';
import {
  CircuitBreakerService,
  DEFAULT_ERROR_FILTER,
  FILTERED_BUSINESS_STATUS,
} from './circuit-breaker.service';
import { METRICS_REGISTRY, buildHttpError } from './circuit-breaker.constants';

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

    it('shutdown 실패한 breaker는 Map에 보존하고 성공한 것만 제거한다 (retry 가능)', () => {
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
      // 성공한 것은 Map에서 제거
      expect(service.getBreaker('shutdown-ok')).toBeUndefined();
      // 실패한 것은 Map에 보존 — 호출자가 retry할 수 있도록 참조 유지
      expect(service.getBreaker('shutdown-fail')).toBe(bFail);
    });
  });

  // ─── 11. errorFilter — 비즈니스 4xx 화이트리스트만 CB 제외 (Sprint 135 D8) ─────────
  describe('errorFilter — 비즈니스 4xx 화이트리스트만 CB 제외 (Wave B 동기화)', () => {
    describe('FILTERED_BUSINESS_STATUS 화이트리스트 정의', () => {
      it('404/410/422만 포함하고 400/401/403/408/429/5xx는 제외한다', () => {
        // Wave B Critic 3차 P2: 400은 contract regression 보호 대상
        // 401/403은 인증 outage / 408 timeout / 429 rate limit / 5xx는 회로 보호 대상
        expect(FILTERED_BUSINESS_STATUS.has(404)).toBe(true);
        expect(FILTERED_BUSINESS_STATUS.has(410)).toBe(true);
        expect(FILTERED_BUSINESS_STATUS.has(422)).toBe(true);
        // 보호 대상 (CB failure로 카운트되어야 함)
        expect(FILTERED_BUSINESS_STATUS.has(400)).toBe(false);
        expect(FILTERED_BUSINESS_STATUS.has(401)).toBe(false);
        expect(FILTERED_BUSINESS_STATUS.has(403)).toBe(false);
        expect(FILTERED_BUSINESS_STATUS.has(408)).toBe(false);
        expect(FILTERED_BUSINESS_STATUS.has(429)).toBe(false);
        expect(FILTERED_BUSINESS_STATUS.has(500)).toBe(false);
      });
    });

    describe('DEFAULT_ERROR_FILTER 단위 동작', () => {
      it('화이트리스트 status(404/410/422)는 true 반환 (CB failure 제외)', () => {
        expect(DEFAULT_ERROR_FILTER(buildHttpError('not found', 404))).toBe(true);
        expect(DEFAULT_ERROR_FILTER(buildHttpError('gone', 410))).toBe(true);
        expect(DEFAULT_ERROR_FILTER(buildHttpError('unprocessable', 422))).toBe(true);
      });

      it('화이트리스트 외 4xx(400/401/403)는 false 반환 (CB failure 카운트)', () => {
        expect(DEFAULT_ERROR_FILTER(buildHttpError('bad req', 400))).toBe(false);
        expect(DEFAULT_ERROR_FILTER(buildHttpError('unauthorized', 401))).toBe(false);
        expect(DEFAULT_ERROR_FILTER(buildHttpError('forbidden', 403))).toBe(false);
      });

      it('5xx status는 false 반환 (CB failure 카운트)', () => {
        expect(DEFAULT_ERROR_FILTER(buildHttpError('server', 500))).toBe(false);
        expect(DEFAULT_ERROR_FILTER(buildHttpError('unavail', 503))).toBe(false);
      });

      it('status 없는 에러(네트워크/타임아웃)는 false 반환', () => {
        expect(DEFAULT_ERROR_FILTER(new Error('ENETUNREACH'))).toBe(false);
        expect(DEFAULT_ERROR_FILTER(null)).toBe(false);
        expect(DEFAULT_ERROR_FILTER(undefined)).toBe(false);
        expect(DEFAULT_ERROR_FILTER({})).toBe(false);
      });
    });

    it('404(화이트리스트) 영구 발생 시 CLOSED 유지 + filtered 메트릭만 증가', async () => {
      const action = jest.fn().mockRejectedValue(buildHttpError('not found', 404));
      service.createBreaker('test-404-filtered', action, {
        volumeThreshold: 1,
        errorThresholdPercentage: 1,
        resetTimeout: 30_000,
        rollingCountTimeout: 10_000,
        rollingCountBuckets: 1,
        timeout: false,
      });

      const breaker = service.getBreaker('test-404-filtered')!;

      // 5번 404 throw → errorFilter true → success(error) → filtered 메트릭
      for (let i = 0; i < 5; i++) {
        try {
          await breaker.fire();
        } catch {
          /* 호출자에는 throw 전파되나 CB 통계엔 미반영 */
        }
      }

      expect(service.getState('test-404-filtered')).toBe('CLOSED');

      const metrics = await registry.getMetricsAsJSON();
      const reqMetric = metrics.find(
        (m) => m.name === 'algosu_submission_circuit_breaker_requests_total',
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
      const action = jest.fn().mockRejectedValue(buildHttpError('bad request', 400));
      service.createBreaker('test-400-open', action, {
        volumeThreshold: 1,
        errorThresholdPercentage: 1,
        resetTimeout: 30_000,
        rollingCountTimeout: 10_000,
        rollingCountBuckets: 1,
        timeout: false,
      });

      const breaker = service.getBreaker('test-400-open')!;
      for (let i = 0; i < 3; i++) {
        try { await breaker.fire(); } catch { /* expected */ }
      }

      expect(service.getState('test-400-open')).toBe('OPEN');
    });

    it('401(화이트리스트 외) 영구 발생 시 OPEN 전이 — 인증 outage 보호', async () => {
      const action = jest.fn().mockRejectedValue(buildHttpError('unauthorized', 401));
      service.createBreaker('test-401-open', action, {
        volumeThreshold: 1,
        errorThresholdPercentage: 1,
        resetTimeout: 30_000,
        rollingCountTimeout: 10_000,
        rollingCountBuckets: 1,
        timeout: false,
      });

      const breaker = service.getBreaker('test-401-open')!;
      for (let i = 0; i < 3; i++) {
        try { await breaker.fire(); } catch { /* expected */ }
      }

      expect(service.getState('test-401-open')).toBe('OPEN');
    });

    it('5xx(503) 영구 발생 시 OPEN 전이 — 일반 인프라 장애 보호', async () => {
      const action = jest.fn().mockRejectedValue(buildHttpError('upstream', 503));
      service.createBreaker('test-503-open', action, {
        volumeThreshold: 1,
        errorThresholdPercentage: 1,
        resetTimeout: 30_000,
        rollingCountTimeout: 10_000,
        rollingCountBuckets: 1,
        timeout: false,
      });

      const breaker = service.getBreaker('test-503-open')!;
      for (let i = 0; i < 3; i++) {
        try { await breaker.fire(); } catch { /* expected */ }
      }

      expect(service.getState('test-503-open')).toBe('OPEN');
    });

    it('호출자가 errorFilter override 시 default가 아닌 호출자 함수가 사용됨', async () => {
      // override: 모든 에러를 filtered (= CB failure 미카운트)
      const customFilter = jest.fn().mockReturnValue(true);
      const action = jest.fn().mockRejectedValue(buildHttpError('upstream down', 503));

      service.createBreaker('test-override', action, {
        volumeThreshold: 1,
        errorThresholdPercentage: 1,
        resetTimeout: 30_000,
        rollingCountTimeout: 10_000,
        rollingCountBuckets: 1,
        timeout: false,
        errorFilter: customFilter,
      });

      const breaker = service.getBreaker('test-override')!;
      for (let i = 0; i < 3; i++) {
        try { await breaker.fire(); } catch { /* expected */ }
      }

      // customFilter가 모두 true → OPEN 전이 안 됨 (default였다면 5xx로 OPEN)
      expect(service.getState('test-override')).toBe('CLOSED');
      expect(customFilter).toHaveBeenCalled();
    });

    it('plain object throw + errorFilter 통과 시 filtered 카운트, success 카운트는 미증가 (P2 정확 해결)', async () => {
      // Sprint 135 D8 P2 정확 해결 검증 — non-Error throw도 errorFilter wrapper + WeakSet 마커로 정확히 분기
      const action = jest.fn().mockRejectedValue({ status: 404 });
      service.createBreaker('test-plain', action, {
        volumeThreshold: 100,
        errorThresholdPercentage: 99,
        resetTimeout: 30_000,
        rollingCountTimeout: 10_000,
        rollingCountBuckets: 1,
        timeout: false,
        errorFilter: (err) => (err as { status?: number })?.status === 404,
      });

      const breaker = service.getBreaker('test-plain')!;
      try {
        await breaker.fire();
      } catch {
        /* expected reject */
      }

      const metrics = await registry.getMetricsAsJSON();
      const requests = metrics.find(
        (m) => m.name === 'algosu_submission_circuit_breaker_requests_total',
      );
      const filtered = (requests?.values ?? []).find(
        (v) => v.labels?.['name'] === 'test-plain' && v.labels?.['result'] === 'filtered',
      )?.value;
      const success = (requests?.values ?? []).find(
        (v) => v.labels?.['name'] === 'test-plain' && v.labels?.['result'] === 'success',
      )?.value;

      expect(filtered).toBe(1);
      expect(success).toBeUndefined();
    });

    it('WeakSet 마커가 같은 객체 재사용 시 1회만 filtered로 카운트 (재사용 안전성)', async () => {
      // 두 번 throw하는데 두 번째는 WeakSet에서 delete된 후 평가됨 — wrapper가 filtered 2회 카운트
      // (마커는 success 핸들러가 보고 즉시 delete하므로 같은 객체가 다시 들어와도 정상 카운트)
      const sharedError = { status: 404, msg: 'shared' };
      const action = jest.fn().mockRejectedValue(sharedError);
      service.createBreaker('test-reuse', action, {
        volumeThreshold: 100,
        errorThresholdPercentage: 99,
        resetTimeout: 30_000,
        rollingCountTimeout: 10_000,
        rollingCountBuckets: 1,
        timeout: false,
        errorFilter: (err) => (err as { status?: number })?.status === 404,
      });

      const breaker = service.getBreaker('test-reuse')!;
      for (let i = 0; i < 2; i++) {
        try { await breaker.fire(); } catch { /* expected */ }
      }

      const metrics = await registry.getMetricsAsJSON();
      const requests = metrics.find(
        (m) => m.name === 'algosu_submission_circuit_breaker_requests_total',
      );
      const filtered = (requests?.values ?? []).find(
        (v) => v.labels?.['name'] === 'test-reuse' && v.labels?.['result'] === 'filtered',
      )?.value;
      const success = (requests?.values ?? []).find(
        (v) => v.labels?.['name'] === 'test-reuse' && v.labels?.['result'] === 'success',
      )?.value;

      expect(filtered).toBe(2); // 두 번째 throw도 wrapper에서 정상 카운트
      expect(success).toBeUndefined(); // 마커 delete 후 재추가되어 success 미증가
    });

    it('primitive throw + errorFilter 통과 시 filtered + success 모두 카운트 (한계 케이스 명시)', async () => {
      // primitive(string)는 WeakSet에 추가 불가 → wrapper는 filtered 카운트하나 success 핸들러에서 추가 카운트
      // 본 프로젝트는 Error/객체만 throw하므로 실용적 영향 0이지만 정책상 명시
      const action = jest.fn().mockRejectedValue('primitive-error-string');
      service.createBreaker('test-primitive', action, {
        volumeThreshold: 100,
        errorThresholdPercentage: 99,
        resetTimeout: 30_000,
        rollingCountTimeout: 10_000,
        rollingCountBuckets: 1,
        timeout: false,
        errorFilter: () => true, // 모든 에러를 filtered 처리
      });

      const breaker = service.getBreaker('test-primitive')!;
      try { await breaker.fire(); } catch { /* expected */ }

      const metrics = await registry.getMetricsAsJSON();
      const requests = metrics.find(
        (m) => m.name === 'algosu_submission_circuit_breaker_requests_total',
      );
      const filtered = (requests?.values ?? []).find(
        (v) => v.labels?.['name'] === 'test-primitive' && v.labels?.['result'] === 'filtered',
      )?.value;
      const success = (requests?.values ?? []).find(
        (v) => v.labels?.['name'] === 'test-primitive' && v.labels?.['result'] === 'success',
      )?.value;

      expect(filtered).toBe(1); // wrapper에서 카운트
      expect(success).toBe(1); // primitive는 WeakSet 미추가 → success 핸들러 추가 카운트 (한계)
    });

    it('정상 success(action resolve) 시 filtered 카운트 없음, success 카운트만 증가 (회귀 방지)', async () => {
      const action = jest.fn().mockResolvedValue({ data: 'ok' }); // 객체 반환도 success로 정확히 분기되어야 함
      service.createBreaker('test-resolve-object', action, {
        volumeThreshold: 100,
        errorThresholdPercentage: 99,
        resetTimeout: 30_000,
        rollingCountTimeout: 10_000,
        rollingCountBuckets: 1,
        timeout: false,
      });

      const breaker = service.getBreaker('test-resolve-object')!;
      await breaker.fire();
      await breaker.fire();

      const metrics = await registry.getMetricsAsJSON();
      const requests = metrics.find(
        (m) => m.name === 'algosu_submission_circuit_breaker_requests_total',
      );
      const success = (requests?.values ?? []).find(
        (v) =>
          v.labels?.['name'] === 'test-resolve-object' && v.labels?.['result'] === 'success',
      )?.value;
      const filtered = (requests?.values ?? []).find(
        (v) =>
          v.labels?.['name'] === 'test-resolve-object' && v.labels?.['result'] === 'filtered',
      )?.value;

      expect(success).toBe(2);
      expect(filtered).toBeUndefined();
    });

    it('filtered 카운터가 success 카운터와 분리됨 (혼합 시나리오)', async () => {
      let mode: 'ok' | '404' = 'ok';
      const action = jest.fn().mockImplementation(() => {
        if (mode === 'ok') return Promise.resolve('value');
        return Promise.reject(buildHttpError('not found', 404));
      });

      service.createBreaker('test-mixed', action, {
        volumeThreshold: 100,
        errorThresholdPercentage: 99,
        resetTimeout: 30_000,
        rollingCountTimeout: 10_000,
        rollingCountBuckets: 1,
        timeout: false,
      });

      const breaker = service.getBreaker('test-mixed')!;

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
        (m) => m.name === 'algosu_submission_circuit_breaker_requests_total',
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
  });

  // ─── 12. buildHttpError 헬퍼 (Sprint 135 D8) ───────────────────
  describe('buildHttpError 헬퍼', () => {
    it('Error 인스턴스에 status 속성을 첨부한다', () => {
      const err = buildHttpError('quota check failed', 503);
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toBe('quota check failed');
      expect(err.status).toBe(503);
    });

    it('DEFAULT_ERROR_FILTER가 buildHttpError 결과로 분기 가능', () => {
      expect(DEFAULT_ERROR_FILTER(buildHttpError('not found', 404))).toBe(true);
      expect(DEFAULT_ERROR_FILTER(buildHttpError('upstream', 503))).toBe(false);
    });
  });
});
