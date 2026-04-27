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
 * Sprint 135 Wave B:
 * - 5개 fetch 호출부 모두 CircuitBreakerManager로 보호 (메서드별 별도 CB 인스턴스)
 * - fallback 없음 — 실패 시 throw 전파 (큐가 nack/DLQ 처리)
 */

interface SubmissionData {
  userId: string;
  problemId: string;
  studyId: string;
  language: string;
  code: string;
}

/**
 * HTTP 응답 status를 첨부한 Error 생성 (Sprint 135 D7).
 *
 * CircuitBreakerManager의 DEFAULT_ERROR_FILTER가 `err.status` 400~499 범위를
 * filtered 처리(failure 미카운트)하므로, 4xx 영구 에러로 인한 CB OPEN 회피.
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

  // Wave B: 메서드별 CB 인스턴스 (인자 없는 호출 패턴)
  private readonly getSubmissionBreaker: CircuitBreaker<[string], SubmissionData>;
  private readonly reportSuccessBreaker: CircuitBreaker<[string, string], void>;
  private readonly reportFailedBreaker: CircuitBreaker<[string], void>;
  private readonly reportTokenInvalidBreaker: CircuitBreaker<[string], void>;
  private readonly reportSkippedBreaker: CircuitBreaker<[string], void>;

  constructor(cbManager: CircuitBreakerManager) {
    this.redis = new Redis(config.redisUrl);
    this.submissionUrl = config.submissionServiceUrl;
    this.submissionKey = config.submissionServiceKey;

    this.getSubmissionBreaker = cbManager.createBreaker(
      'submission-getSubmission',
      this._doGetSubmission.bind(this),
    );
    this.reportSuccessBreaker = cbManager.createBreaker(
      'submission-reportSuccess',
      this._doReportSuccess.bind(this),
    );
    this.reportFailedBreaker = cbManager.createBreaker(
      'submission-reportFailed',
      this._doReportFailed.bind(this),
    );
    this.reportTokenInvalidBreaker = cbManager.createBreaker(
      'submission-reportTokenInvalid',
      this._doReportTokenInvalid.bind(this),
    );
    this.reportSkippedBreaker = cbManager.createBreaker(
      'submission-reportSkipped',
      this._doReportSkipped.bind(this),
    );
  }

  /**
   * 제출 데이터 조회 — CB 보호
   */
  async getSubmission(submissionId: string): Promise<SubmissionData> {
    return this.getSubmissionBreaker.fire(submissionId);
  }

  /**
   * 제출 데이터 조회 fetch 본체 (CB action)
   */
  async _doGetSubmission(submissionId: string): Promise<SubmissionData> {
    const res = await fetch(`${this.submissionUrl}/internal/${submissionId}`, {
      headers: {
        'X-Internal-Key': this.submissionKey,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      throw buildHttpError(`Submission 조회 실패: ${res.status}`, res.status);
    }

    const body = (await res.json()) as { data: SubmissionData };
    return body.data;
  }

  /**
   * GitHub Push 성공 보고 — CB 보호
   */
  async reportSuccess(submissionId: string, filePath: string): Promise<void> {
    await this.reportSuccessBreaker.fire(submissionId, filePath);
  }

  /**
   * GitHub Push 성공 보고 fetch 본체 (CB action)
   */
  async _doReportSuccess(submissionId: string, filePath: string): Promise<void> {
    const resp = await fetch(`${this.submissionUrl}/internal/${submissionId}/github-success`, {
      method: 'POST',
      headers: {
        'X-Internal-Key': this.submissionKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ filePath }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!resp.ok) {
      throw buildHttpError(`reportSuccess 실패: ${resp.status}`, resp.status);
    }
  }

  /**
   * GitHub Push 실패 보고 — CB 보호
   */
  async reportFailed(submissionId: string): Promise<void> {
    await this.reportFailedBreaker.fire(submissionId);
  }

  /**
   * GitHub Push 실패 보고 fetch 본체 (CB action)
   */
  async _doReportFailed(submissionId: string): Promise<void> {
    const resp = await fetch(`${this.submissionUrl}/internal/${submissionId}/github-failed`, {
      method: 'POST',
      headers: {
        'X-Internal-Key': this.submissionKey,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!resp.ok) {
      throw buildHttpError(`reportFailed 실패: ${resp.status}`, resp.status);
    }
  }

  /**
   * TOKEN_INVALID 보고 — CB 보호
   */
  async reportTokenInvalid(submissionId: string): Promise<void> {
    await this.reportTokenInvalidBreaker.fire(submissionId);
  }

  /**
   * TOKEN_INVALID 보고 fetch 본체 (CB action)
   */
  async _doReportTokenInvalid(submissionId: string): Promise<void> {
    const resp = await fetch(`${this.submissionUrl}/internal/${submissionId}/github-token-invalid`, {
      method: 'POST',
      headers: {
        'X-Internal-Key': this.submissionKey,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!resp.ok) {
      throw buildHttpError(`reportTokenInvalid 실패: ${resp.status}`, resp.status);
    }
  }

  /**
   * SKIPPED 보고 + Redis Pub/Sub — CB 보호 (HTTP 호출만)
   * github_sync_status = SKIPPED 로 업데이트
   */
  async reportSkipped(submissionId: string): Promise<void> {
    await this.reportSkippedBreaker.fire(submissionId);

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
   * SKIPPED 보고 fetch 본체 (CB action)
   */
  async _doReportSkipped(submissionId: string): Promise<void> {
    const resp = await fetch(`${this.submissionUrl}/internal/${submissionId}/github-skipped`, {
      method: 'POST',
      headers: {
        'X-Internal-Key': this.submissionKey,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!resp.ok) {
      throw buildHttpError(`reportSkipped 실패: ${resp.status}`, resp.status);
    }
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
