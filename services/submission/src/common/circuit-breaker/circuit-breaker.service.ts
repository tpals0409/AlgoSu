/**
 * @file circuit-breaker.service.ts -- opossum Circuit Breaker 관리 + Prometheus 메트릭
 * @domain common
 * @layer service
 * @related circuit-breaker.module.ts, circuit-breaker.constants.ts, metrics.service.ts
 */

import { Inject, Injectable } from '@nestjs/common';
import * as CircuitBreaker from 'opossum';
import { Registry, Gauge, Counter } from 'prom-client';
import { StructuredLoggerService } from '../logger/structured-logger.service';
import { METRICS_REGISTRY } from './circuit-breaker.constants';
import { DEFAULT_CB_OPTIONS } from './circuit-breaker.constants';

/** CB 상태 코드 -- Prometheus Gauge 값 */
const STATE_CODE = { closed: 0, halfOpen: 1, open: 2 } as const;

/** CB 생성 시 전달 가능한 추가 옵션 */
export interface CreateBreakerOptions {
  timeout?: number | false;
  errorThresholdPercentage?: number;
  resetTimeout?: number;
  rollingCountTimeout?: number;
  rollingCountBuckets?: number;
  volumeThreshold?: number;
  fallback?: (...args: unknown[]) => unknown;
}

@Injectable()
export class CircuitBreakerService {
  private readonly logger: StructuredLoggerService;
  private readonly breakers = new Map<string, CircuitBreaker>();

  private readonly stateGauge: Gauge<string>;
  private readonly failuresCounter: Counter<string>;
  private readonly requestsCounter: Counter<string>;

  constructor(
    @Inject(METRICS_REGISTRY) private readonly registry: Registry,
  ) {
    this.logger = new StructuredLoggerService();
    this.logger.setContext(CircuitBreakerService.name);

    this.stateGauge = new Gauge({
      name: 'algosu_submission_circuit_breaker_state',
      help: 'Circuit breaker state (0=CLOSED, 1=HALF_OPEN, 2=OPEN)',
      labelNames: ['name'] as const,
      registers: [this.registry],
    });

    this.failuresCounter = new Counter({
      name: 'algosu_submission_circuit_breaker_failures_total',
      help: 'Total circuit breaker failures',
      labelNames: ['name'] as const,
      registers: [this.registry],
    });

    this.requestsCounter = new Counter({
      name: 'algosu_submission_circuit_breaker_requests_total',
      help: 'Total circuit breaker requests by result',
      labelNames: ['name', 'result'] as const,
      registers: [this.registry],
    });
  }

  /**
   * opossum CircuitBreaker 인스턴스 생성 및 등록
   *
   * @param name 고유 이름 (메트릭 label)
   * @param action CB로 보호할 비동기 함수
   * @param options opossum 옵션 + fallback
   * @returns 생성된 CircuitBreaker 인스턴스
   */
  createBreaker<TI extends unknown[], TR>(
    name: string,
    action: (...args: TI) => Promise<TR>,
    options?: CreateBreakerOptions,
  ): CircuitBreaker<TI, TR> {
    const { fallback, ...cbOptions } = options ?? {};

    const breaker = new CircuitBreaker<TI, TR>(action, {
      ...DEFAULT_CB_OPTIONS,
      ...cbOptions,
      name,
    });

    if (fallback) {
      breaker.fallback(fallback as (...args: unknown[]) => unknown);
    }

    this.attachEventHandlers(name, breaker);
    this.breakers.set(name, breaker as unknown as CircuitBreaker);
    this.stateGauge.set({ name }, STATE_CODE.closed);

    this.logger.log(`CircuitBreaker 생성: name=${name}`);
    return breaker;
  }

  /**
   * 이름으로 기존 CircuitBreaker 인스턴스 조회
   *
   * @param name 등록된 CB 이름
   * @returns CircuitBreaker 인스턴스 또는 undefined
   */
  getBreaker(name: string): CircuitBreaker | undefined {
    return this.breakers.get(name);
  }

  /**
   * CB 현재 상태 문자열 반환
   *
   * @param name 등록된 CB 이름
   * @returns 'CLOSED' | 'HALF_OPEN' | 'OPEN' | undefined
   */
  getState(name: string): string | undefined {
    const breaker = this.breakers.get(name);
    if (!breaker) return undefined;

    if (breaker.opened) return 'OPEN';
    if (breaker.halfOpen) return 'HALF_OPEN';
    return 'CLOSED';
  }

  /**
   * opossum 이벤트에 Prometheus 메트릭 핸들러 바인딩
   */
  private attachEventHandlers(
    name: string,
    breaker: CircuitBreaker,
  ): void {
    breaker.on('open', () => {
      this.stateGauge.set({ name }, STATE_CODE.open);
      this.logger.warn(`CB OPEN: name=${name}`);
    });

    breaker.on('halfOpen', () => {
      this.stateGauge.set({ name }, STATE_CODE.halfOpen);
      this.logger.log(`CB HALF_OPEN: name=${name}`);
    });

    breaker.on('close', () => {
      this.stateGauge.set({ name }, STATE_CODE.closed);
      this.logger.log(`CB CLOSED: name=${name}`);
    });

    breaker.on('success', () => {
      this.requestsCounter.inc({ name, result: 'success' });
    });

    breaker.on('failure', () => {
      this.failuresCounter.inc({ name });
      this.requestsCounter.inc({ name, result: 'failure' });
    });

    breaker.on('reject', () => {
      this.requestsCounter.inc({ name, result: 'reject' });
    });

    breaker.on('timeout', () => {
      this.requestsCounter.inc({ name, result: 'timeout' });
    });
  }
}
