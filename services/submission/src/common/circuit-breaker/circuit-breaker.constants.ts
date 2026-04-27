/**
 * @file circuit-breaker.constants.ts -- Injection token + opossum 기본 설정
 * @domain common
 * @layer constant
 * @related circuit-breaker.service.ts, circuit-breaker.module.ts
 */

/** NestJS DI Injection Token -- MetricsModule Registry 공유 */
export const METRICS_REGISTRY = 'METRICS_REGISTRY';

/** CircuitBreaker 옵션 Injection Token */
export const CIRCUIT_BREAKER_OPTIONS = 'CIRCUIT_BREAKER_OPTIONS';

/**
 * opossum 기본 설정 -- Python 참조 구현 일관성
 * @see services/ai-analysis/src/circuit_breaker.py
 */
export const DEFAULT_CB_OPTIONS = {
  timeout: 10_000,
  errorThresholdPercentage: 50,
  resetTimeout: 30_000,
  rollingCountTimeout: 60_000,
  rollingCountBuckets: 6,
  volumeThreshold: 5,
} as const;
