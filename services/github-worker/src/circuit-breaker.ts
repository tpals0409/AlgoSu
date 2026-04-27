/**
 * @file circuit-breaker.ts -- opossum Circuit Breaker 관리 + Prometheus 메트릭 (standalone)
 * @domain github
 * @layer service
 * @related worker.ts, status-reporter.ts, metrics.ts, logger.ts
 *
 * Wave A(submission CircuitBreakerService)의 plain-class 포팅 버전.
 * NestJS DI 미사용 환경에서 동작하도록 Registry를 생성자 주입.
 */

import CircuitBreaker from 'opossum';
import { Registry, Gauge, Counter } from 'prom-client';
import { logger } from './logger';

/** opossum timeout 에러 코드 -- timeout/failure 이벤트 중복 카운트 방지용 */
const OPOSSUM_TIMEOUT_CODE = 'ETIMEDOUT';

/** CB 상태 코드 -- Prometheus Gauge 값 */
const STATE_CODE = { closed: 0, halfOpen: 1, open: 2 } as const;

/**
 * CB failure에서 제외할 비즈니스 의미 4xx 화이트리스트 (Sprint 135 D7 — Critic 2차 P1).
 *
 * 정책: retry해도 결과 동일한 영구 비즈니스 에러만 제외. 401/403(인증 장애)·408(timeout)·
 * 429(rate limit)·기타는 CB failure로 카운트하여 internal-auth outage / overload 시
 * 회로 OPEN으로 보호.
 *
 * - 400 Bad Request — 요청 검증 실패 (영구)
 * - 404 Not Found — 삭제된/없는 리소스 (영구)
 * - 410 Gone — 영구 제거된 리소스
 * - 422 Unprocessable Entity — 비즈니스 룰 위반 (영구)
 *
 * 401/403은 X-Internal-Key 회전/오설정으로 영구 발생 시 CB OPEN을 통해 빠른 차단 +
 * 알람 트리거가 의도된 동작이므로 화이트리스트에서 제외.
 */
export const FILTERED_BUSINESS_STATUS = new Set<number>([400, 404, 410, 422]);

/**
 * 기본 errorFilter -- 비즈니스 의미 4xx 화이트리스트만 CB failure에서 제외.
 *
 * opossum `errorFilter`는 true 반환 시 success 이벤트로 처리되어 failure counter 미증가 +
 * OPEN 전이 미트리거. CB는 인프라 장애(5xx/timeout/network)·인증 outage·rate limit 보호용.
 *
 * 호출부에서 fetch non-ok 응답 시 throw하는 Error에 `status` 필드를 첨부하면 본 필터가
 * 분기. status 미첨부(네트워크 에러 등)는 false → CB failure 정상 카운트.
 */
export const DEFAULT_ERROR_FILTER = (err: unknown): boolean => {
  const status = (err as { status?: number } | null)?.status;
  return typeof status === 'number' && FILTERED_BUSINESS_STATUS.has(status);
};

/**
 * opossum 기본 설정 -- Wave A(submission) / Python 참조 일관성
 * @see services/submission/src/common/circuit-breaker/circuit-breaker.constants.ts
 * @see services/ai-analysis/src/circuit_breaker.py
 */
export const DEFAULT_CB_OPTIONS = {
  timeout: 10_000,
  errorThresholdPercentage: 50,
  resetTimeout: 30_000,
  rollingCountTimeout: 60_000,
  rollingCountBuckets: 6,
  volumeThreshold: 5,
  errorFilter: DEFAULT_ERROR_FILTER,
} as const;

/** CB 생성 시 전달 가능한 추가 옵션 */
export interface CreateBreakerOptions {
  timeout?: number | false;
  errorThresholdPercentage?: number;
  resetTimeout?: number;
  rollingCountTimeout?: number;
  rollingCountBuckets?: number;
  volumeThreshold?: number;
  fallback?: (...args: unknown[]) => unknown;
  /**
   * opossum errorFilter override -- 미지정 시 DEFAULT_ERROR_FILTER 사용 (4xx 제외).
   * true 반환 시 해당 에러는 CB failure로 카운트되지 않는다.
   */
  errorFilter?: (err: unknown) => boolean;
}

/**
 * CircuitBreakerManager -- opossum CB 인스턴스 등록/조회/종료 + 메트릭 emit
 *
 * NestJS DI 미사용. main.ts에서 인스턴스 1개 생성 후 GitHubWorker/StatusReporter
 * 생성자에 주입한다. Registry는 metrics.ts에서 export한 동일 객체를 공유한다.
 */
export class CircuitBreakerManager {
  private readonly breakers = new Map<string, CircuitBreaker>();

  private readonly stateGauge: Gauge<string>;
  private readonly failuresCounter: Counter<string>;
  private readonly requestsCounter: Counter<string>;

  constructor(private readonly registry: Registry) {
    this.stateGauge = new Gauge({
      name: 'algosu_github_worker_circuit_breaker_state',
      help: 'Circuit breaker state (0=CLOSED, 1=HALF_OPEN, 2=OPEN)',
      labelNames: ['name'] as const,
      registers: [this.registry],
    });

    this.failuresCounter = new Counter({
      name: 'algosu_github_worker_circuit_breaker_failures_total',
      help: 'Total circuit breaker failures',
      labelNames: ['name'] as const,
      registers: [this.registry],
    });

    this.requestsCounter = new Counter({
      name: 'algosu_github_worker_circuit_breaker_requests_total',
      // result 라벨 enum: success | failure | reject | timeout | filtered
      // - success: 정상 호출 성공
      // - failure: action throw (CB failure로 카운트, OPEN 전이 후보)
      // - reject: CB OPEN 상태에서 거부됨
      // - timeout: opossum timeout 초과
      // - filtered: errorFilter 화이트리스트(4xx 비즈니스) 통과 — failure 미카운트, success와 분리
      help: 'Total circuit breaker requests by result (success|failure|reject|timeout|filtered)',
      labelNames: ['name', 'result'] as const,
      registers: [this.registry],
    });
  }

  /**
   * opossum CircuitBreaker 인스턴스 생성 및 등록
   *
   * @param name 고유 이름 (메트릭 label, 호출부 식별자)
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

    logger.info('CircuitBreaker 생성', { tag: 'CB_CREATE', action: name });
    return breaker;
  }

  /**
   * 이름으로 등록된 CircuitBreaker 인스턴스 조회
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
  getState(name: string): 'CLOSED' | 'HALF_OPEN' | 'OPEN' | undefined {
    const breaker = this.breakers.get(name);
    if (!breaker) return undefined;
    if (breaker.opened) return 'OPEN';
    if (breaker.halfOpen) return 'HALF_OPEN';
    return 'CLOSED';
  }

  /**
   * 모든 등록된 CB의 내부 타이머(bucket rotation)를 정리
   *
   * opossum은 stats bucket 갱신용 setInterval을 보유하므로 graceful shutdown 시
   * 명시적 shutdown이 없으면 프로세스 종료가 지연될 수 있다.
   * 성공한 인스턴스만 Map에서 제거하고, 실패는 보존하여 호출자가 retry 가능하게 한다.
   */
  shutdown(): void {
    for (const [name, breaker] of this.breakers) {
      try {
        breaker.shutdown();
        this.breakers.delete(name);
        logger.info('CircuitBreaker shutdown', { tag: 'CB_SHUTDOWN', action: name });
      } catch (error: unknown) {
        logger.warn('CircuitBreaker shutdown 실패 -- Map에 보존', {
          tag: 'CB_SHUTDOWN_FAIL',
          action: name,
          err: error,
        });
      }
    }
  }

  /**
   * opossum 이벤트에 Prometheus 메트릭/상태 핸들러 바인딩
   */
  private attachEventHandlers(name: string, breaker: CircuitBreaker): void {
    breaker.on('open', () => {
      this.stateGauge.set({ name }, STATE_CODE.open);
      logger.warn('CB OPEN', { tag: 'CB_OPEN', action: name });
    });

    breaker.on('halfOpen', () => {
      this.stateGauge.set({ name }, STATE_CODE.halfOpen);
      logger.info('CB HALF_OPEN', { tag: 'CB_HALF_OPEN', action: name });
    });

    breaker.on('close', () => {
      this.stateGauge.set({ name }, STATE_CODE.closed);
      logger.info('CB CLOSED', { tag: 'CB_CLOSE', action: name });
    });

    breaker.on('success', (result: unknown) => {
      // opossum은 errorFilter 통과 시 `circuit.emit('success', error, latency)`로 emit하므로
      // 첫 인자가 Error 인스턴스인 경우는 실제 성공이 아닌 filtered 케이스 (Sprint 135 D7 Critic 2차 P2).
      // 메트릭 정확성을 위해 'filtered' 라벨로 분리 카운트하여 success 카운트 오염 방지.
      if (result instanceof Error) {
        this.requestsCounter.inc({ name, result: 'filtered' });
        return;
      }
      this.requestsCounter.inc({ name, result: 'success' });
    });

    breaker.on('failure', (error: unknown) => {
      // opossum은 timeout 시 'timeout' + 'failure' 두 이벤트를 모두 emit하므로
      // result 라벨이 mutually exclusive하도록 timeout 분기를 제외한다 (메트릭 중복 카운트 방지)
      if ((error as { code?: string } | null)?.code === OPOSSUM_TIMEOUT_CODE) {
        this.failuresCounter.inc({ name });
        return;
      }
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
