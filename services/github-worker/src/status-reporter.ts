/**
 * @file 상태 리포터 — Submission HTTP 콜백 + Redis Pub/Sub 브로드캐스트
 * @domain github
 * @layer service
 * @related worker.ts, sse.controller.ts (gateway), circuit-breaker.ts
 */
import Redis from 'ioredis';
import type CircuitBreaker from 'opossum';
import { logger } from './logger';
import { config } from './config';
import { CircuitBreakerManager } from './circuit-breaker';

/**
 * 상태 리포터 — Submission Service 콜백 + Redis Pub/Sub
 *
 * 역할:
 * 1. Submission Service에 HTTP 콜백 (saga_step 업데이트)
 * 2. Redis Pub/Sub으로 상태 브로드캐스트 (Gateway SSE → 클라이언트)
 *
 * 보안:
 * - Internal API Key 사용 (환경변수에서만 참조)
 * - 토큰/키 로그 출력 금지
 *
 * Sprint 135 Wave B (Critic 3차 P1):
 * - 5개 fetch 호출부 모두 동일 호스트(submission-service) → **호스트 단일 CB**(`submission-internal`)로 통합
 * - generic dispatcher(`_dispatch` + `_resolveEndpoint`)로 5개 op 공유
 * - 호스트 장애 시 모든 메서드 동시 차단 → dead host 부하 증폭 방지
 * - fallback 없음 — 실패 시 throw 전파 (큐가 nack/DLQ 처리)
 */

interface SubmissionData {
  userId: string;
  problemId: string;
  studyId: string;
  language: string;
  code: string;
}

/** submission-internal 호환 op 타입 */
type SubmissionOp =
  | 'get'
  | 'reportSuccess'
  | 'reportFailed'
  | 'reportTokenInvalid'
  | 'reportSkipped';

/** 호스트 단일 CB로 전달되는 요청 페이로드 */
interface SubmissionRequest {
  op: SubmissionOp;
  submissionId: string;
  body?: unknown;
}

/** op별 endpoint 메타데이터 */
interface EndpointMeta {
  method: 'GET' | 'POST';
  path: string;
  hasJsonResponse: boolean;
}

/**
 * HTTP 응답 status를 첨부한 Error 생성 (Sprint 135 D7).
 *
 * CircuitBreakerManager의 DEFAULT_ERROR_FILTER가 `err.status` 화이트리스트
 * (404/410/422)를 filtered 처리(failure 미카운트)하므로, 영구 비즈니스 에러로
 * 인한 CB OPEN 회피. 400은 contract regression 보호를 위해 미포함.
 */
function buildHttpError(message: string, status: number): Error & { status: number } {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}

export class StatusReporter {
  private redis: Redis;
  private readonly submissionUrl: string;
  private readonly submissionKey: string;

  /**
   * 호스트 단일 CB — submission-service 5개 메서드 통합 보호 (Critic 3차 P1).
   * 호스트 경계에서 OPEN되면 모든 메서드가 동시 차단되어 dead host 보호.
   */
  private readonly hostBreaker: CircuitBreaker<[SubmissionRequest], unknown>;

  constructor(cbManager: CircuitBreakerManager) {
    this.redis = new Redis(config.redisUrl);
    this.submissionUrl = config.submissionServiceUrl;
    this.submissionKey = config.submissionServiceKey;

    this.hostBreaker = cbManager.createBreaker(
      'submission-internal',
      this._dispatch.bind(this),
    );
  }

  /**
   * 단일 dispatcher — 모든 submission-internal HTTP 호출을 통일.
   * 호스트 경계에서 CB가 OPEN되면 모든 메서드가 동시 차단되어 dead host 보호.
   */
  async _dispatch(req: SubmissionRequest): Promise<unknown> {
    const { op, submissionId, body } = req;
    const { method, path, hasJsonResponse } = this._resolveEndpoint(op, submissionId);

    const res = await fetch(`${this.submissionUrl}${path}`, {
      method,
      headers: {
        'X-Internal-Key': this.submissionKey,
        'Content-Type': 'application/json',
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      throw buildHttpError(
        `submission ${op} 실패 (${method} ${path}): ${res.status}`,
        res.status,
      );
    }

    return hasJsonResponse ? await res.json() : null;
  }

  /**
   * op별 endpoint 메타데이터 매핑 (단일 책임 — 테스트 분리 용이).
   */
  _resolveEndpoint(op: SubmissionOp, submissionId: string): EndpointMeta {
    switch (op) {
      case 'get':
        return {
          method: 'GET',
          path: `/internal/${submissionId}`,
          hasJsonResponse: true,
        };
      case 'reportSuccess':
        return {
          method: 'POST',
          path: `/internal/${submissionId}/github-success`,
          hasJsonResponse: false,
        };
      case 'reportFailed':
        return {
          method: 'POST',
          path: `/internal/${submissionId}/github-failed`,
          hasJsonResponse: false,
        };
      case 'reportTokenInvalid':
        return {
          method: 'POST',
          path: `/internal/${submissionId}/github-token-invalid`,
          hasJsonResponse: false,
        };
      case 'reportSkipped':
        return {
          method: 'POST',
          path: `/internal/${submissionId}/github-skipped`,
          hasJsonResponse: false,
        };
    }
  }

  /**
   * 제출 데이터 조회 — 호스트 CB 보호.
   */
  async getSubmission(submissionId: string): Promise<SubmissionData> {
    const result = await this.hostBreaker.fire({ op: 'get', submissionId });
    return (result as { data: SubmissionData }).data;
  }

  /**
   * GitHub Push 성공 보고 — 호스트 CB 보호.
   */
  async reportSuccess(submissionId: string, filePath: string): Promise<void> {
    await this.hostBreaker.fire({
      op: 'reportSuccess',
      submissionId,
      body: { filePath },
    });
  }

  /**
   * GitHub Push 실패 보고 — 호스트 CB 보호.
   */
  async reportFailed(submissionId: string): Promise<void> {
    await this.hostBreaker.fire({ op: 'reportFailed', submissionId });
  }

  /**
   * TOKEN_INVALID 보고 — 호스트 CB 보호.
   */
  async reportTokenInvalid(submissionId: string): Promise<void> {
    await this.hostBreaker.fire({ op: 'reportTokenInvalid', submissionId });
  }

  /**
   * SKIPPED 보고 + Redis Pub/Sub — HTTP 호출은 호스트 CB 보호.
   * github_sync_status = SKIPPED 로 업데이트 후 SSE 구독자에게 브로드캐스트.
   */
  async reportSkipped(submissionId: string): Promise<void> {
    await this.hostBreaker.fire({ op: 'reportSkipped', submissionId });

    await this.redis.publish(
      `submission:status:${submissionId}`,
      JSON.stringify({
        submissionId,
        status: 'github_skipped',
        timestamp: new Date().toISOString(),
      }),
    );

    logger.info('SKIPPED 보고 완료', { action: 'REPORT_SKIPPED' });
  }

  /**
   * Redis Pub/Sub 상태 브로드캐스트
   * Gateway SSE가 구독 → 클라이언트로 전달
   */
  async publishStatusChange(
    submissionId: string,
    status: string,
  ): Promise<void> {
    const channel = `submission:status:${submissionId}`;
    const payload = JSON.stringify({
      submissionId,
      status,
      timestamp: new Date().toISOString(),
    });

    await this.redis.publish(channel, payload);
    logger.info('Pub/Sub 발행 완료', { action: 'PUBSUB_PUBLISH' });
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }
}
