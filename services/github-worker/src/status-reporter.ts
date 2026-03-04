/**
 * @file 상태 리포터 — Submission HTTP 콜백 + Redis Pub/Sub 브로드캐스트
 * @domain github
 * @layer service
 * @related worker.ts, sse.controller.ts (gateway)
 */
import Redis from 'ioredis';
import { logger } from './logger';
import { config } from './config';

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
 */

interface SubmissionData {
  userId: string;
  problemId: string;
  studyId: string;
  language: string;
  code: string;
}

export class StatusReporter {
  private redis: Redis;
  private readonly submissionUrl: string;
  private readonly submissionKey: string;

  constructor() {
    this.redis = new Redis(config.redisUrl);
    this.submissionUrl = config.submissionServiceUrl;
    this.submissionKey = config.submissionServiceKey;
  }

  /**
   * 제출 데이터 조회 (Submission Service 내부 HTTP)
   */
  async getSubmission(submissionId: string): Promise<SubmissionData> {
    const res = await fetch(`${this.submissionUrl}/internal/${submissionId}`, {
      headers: {
        'X-Internal-Key': this.submissionKey,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`Submission 조회 실패: ${res.status}`);
    }

    const body = (await res.json()) as { data: SubmissionData };
    return body.data;
  }

  /**
   * GitHub Push 성공 보고
   */
  async reportSuccess(submissionId: string, filePath: string): Promise<void> {
    await fetch(`${this.submissionUrl}/internal/${submissionId}/github-success`, {
      method: 'POST',
      headers: {
        'X-Internal-Key': this.submissionKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ filePath }),
    });
  }

  /**
   * GitHub Push 실패 보고
   */
  async reportFailed(submissionId: string): Promise<void> {
    await fetch(`${this.submissionUrl}/internal/${submissionId}/github-failed`, {
      method: 'POST',
      headers: {
        'X-Internal-Key': this.submissionKey,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * TOKEN_INVALID 보고
   */
  async reportTokenInvalid(submissionId: string): Promise<void> {
    await fetch(`${this.submissionUrl}/internal/${submissionId}/github-token-invalid`, {
      method: 'POST',
      headers: {
        'X-Internal-Key': this.submissionKey,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * SKIPPED 보고 — 스터디에 GitHub 레포가 연결되지 않은 경우
   * github_sync_status = SKIPPED 로 업데이트
   */
  async reportSkipped(submissionId: string): Promise<void> {
    await fetch(`${this.submissionUrl}/internal/${submissionId}/github-skipped`, {
      method: 'POST',
      headers: {
        'X-Internal-Key': this.submissionKey,
        'Content-Type': 'application/json',
      },
    });

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
