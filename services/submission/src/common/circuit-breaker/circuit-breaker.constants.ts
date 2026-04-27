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

/**
 * HTTP 응답 status를 첨부한 Error 빌더 -- CB errorFilter 분기용 (Sprint 135 D8 — Wave A 동기화)
 *
 * 호출부에서 fetch non-ok 응답 시 본 헬퍼로 Error를 생성하면 `DEFAULT_ERROR_FILTER`가 status를
 * 검사하여 비즈니스 화이트리스트(404/410/422) 통과 여부를 판단할 수 있다.
 *
 * @param message 에러 메시지
 * @param status HTTP 응답 status code
 * @returns status 속성이 첨부된 Error 인스턴스
 */
export function buildHttpError(
  message: string,
  status: number,
): Error & { status: number } {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}
