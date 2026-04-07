/**
 * @file GitHub Worker — RabbitMQ 소비자 + 유저 토큰 기반 Push
 * @domain github
 * @layer service
 * @related github-push.service.ts, token-manager.ts, status-reporter.ts
 */
import * as amqplib from 'amqplib';
import Redis from 'ioredis';
import { GitHubPushService, GitHubRateLimitError } from './github-push.service';
import { TokenManager } from './token-manager';
import { StatusReporter } from './status-reporter';
import { logger } from './logger';
import { config } from './config';
import { dlqMessagesTotal, mqMessagesProcessedTotal } from './metrics';

/**
 * GitHub Worker — RabbitMQ 소비자 (유저 토큰 기반)
 *
 * 보안 요구사항:
 * - GitHub 토큰은 AES-256-GCM 복호화 후 즉시 사용, 로그 출력 금지
 * - 메시지에 토큰/키 포함 금지
 * - Gateway Internal API 호출 시 X-Internal-Key 필수
 * - prefetch=2: 동시 처리량 제한 (Free Tier 리소스 보호)
 *
 * 재연결 정책 (M14):
 * - MQ 연결 끊김 시 process.exit 대신 지수 백오프 재연결
 * - 1s → 2s → 4s → ... 최대 30s
 */

interface GitHubPushEvent {
  submissionId: string;
  studyId: string;
  timestamp: string;
}

interface UserGitHubInfo {
  github_username: string | null;
  github_token: string | null;
}

const QUEUE = 'submission.github_push';
const MAX_RETRIES = config.maxRetries;
const RETRY_DELAY_MS = config.retryDelayMs;
const MAX_RECONNECT_DELAY_MS = 30_000;
const IDEMPOTENCY_TTL_SECONDS = 3600;

export class GitHubWorker {
  private connection: amqplib.ChannelModel | null = null;
  private channel: amqplib.Channel | null = null;
  private pushService: GitHubPushService;
  private tokenManager: TokenManager;
  private statusReporter: StatusReporter;
  private redis: Redis;

  private readonly gatewayInternalUrl: string;
  private readonly internalKeyGateway: string;
  private readonly problemServiceUrl: string;
  private readonly problemServiceKey: string;

  // M14: 재연결 상태 추적
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isShuttingDown = false;

  constructor() {
    this.tokenManager = new TokenManager();
    this.pushService = new GitHubPushService();
    this.statusReporter = new StatusReporter();
    this.redis = new Redis(config.redisUrl);
    this.gatewayInternalUrl = config.gatewayInternalUrl;
    this.internalKeyGateway = config.internalKeyGateway;
    this.problemServiceUrl = config.problemServiceUrl;
    this.problemServiceKey = config.problemServiceKey;
  }

  /**
   * M14: 지수 백오프 재연결 스케줄러
   * 1s → 2s → 4s → ... 최대 30s
   */
  private scheduleReconnect(): void {
    if (this.isShuttingDown || this.reconnectTimer) return;

    const delay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempt),
      MAX_RECONNECT_DELAY_MS,
    );
    this.reconnectAttempt++;

    logger.warn('RabbitMQ 재연결 예정', {
      tag: 'MQ_RECONNECT',
      delayMs: delay,
      attempt: this.reconnectAttempt,
    });

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.start().then(() => {
        this.reconnectAttempt = 0;
        logger.info('RabbitMQ 재연결 성공', { tag: 'MQ_RECONNECT' });
      }).catch((err: Error) => {
        logger.error('RabbitMQ 재연결 실패 — 재시도 예정', { tag: 'MQ_RECONNECT', err });
        this.scheduleReconnect();
      });
    }, delay);
  }

  async start(): Promise<void> {
    this.connection = await amqplib.connect(config.rabbitmqUrl);

    // C5: MQ 연결 오류/종료 핸들러 — M14 재연결 적용
    this.connection.on('error', (err: Error) => {
      logger.error('RabbitMQ 연결 오류', { tag: 'MQ_CONNECTION_ERROR', err });
    });
    this.connection.on('close', () => {
      if (this.isShuttingDown) return;
      logger.warn('RabbitMQ 연결 종료 — 재연결 시도', { tag: 'MQ_CONNECTION_CLOSED' });
      this.connection = null;
      this.channel = null;
      this.scheduleReconnect();
    });

    const channel = await this.connection.createChannel();
    this.channel = channel;

    // prefetch=2: 동시 처리량 제한
    await channel.prefetch(2);

    await channel.assertQueue(QUEUE, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': 'submission.events.dlx',
        'x-dead-letter-routing-key': 'github.push.dead',
      },
    });

    logger.info('큐 구독 시작', { tag: 'MQ_CONSUME', queue: QUEUE });

    await channel.consume(QUEUE, async (msg) => {
      if (!msg) return;

      // C3: JSON 파싱을 비즈니스 로직과 분리
      let event: GitHubPushEvent;
      try {
        event = JSON.parse(msg.content.toString()) as GitHubPushEvent;
      } catch (parseErr) {
        logger.error('MQ 메시지 JSON 파싱 실패 — DLQ', {
          tag: 'MQ_CONSUME_DONE',
          traceId: 'UNKNOWN',
          result: 'NACK_DLQ',
          code: 'MQ_001',
          err: parseErr as Error,
          deliveryTag: msg.fields.deliveryTag,
        });
        channel.nack(msg, false, false);
        dlqMessagesTotal.inc({ reason: 'parse_error' });
        mqMessagesProcessedTotal.inc({ result: 'nack_dlq' });
        return;
      }

      const startTime = Date.now();

      try {
        // C-7: submissionId 기반 멱등성 체크
        const idempotencyKey = `ghw:processed:${event.submissionId}`;
        const alreadyProcessed = await this.redis.get(idempotencyKey);

        if (alreadyProcessed) {
          logger.info('중복 메시지 — ACK만 수행', {
            tag: 'MQ_IDEMPOTENT_SKIP',
            traceId: event.submissionId,
            deliveryTag: msg.fields.deliveryTag,
          });
          channel.ack(msg);
          mqMessagesProcessedTotal.inc({ result: 'idempotent_skip' });
          return;
        }

        logger.info('MQ 메시지 소비 시작', {
          tag: 'MQ_CONSUME',
          queue: QUEUE,
          traceId: event.submissionId,
          deliveryTag: msg.fields.deliveryTag,
          redelivered: msg.fields.redelivered,
        });

        await this.processWithRetry(event);

        // 처리 완료 후 멱등성 키 기록 (TTL 1시간)
        await this.redis.set(idempotencyKey, '1', 'EX', IDEMPOTENCY_TTL_SECONDS);

        channel.ack(msg);

        mqMessagesProcessedTotal.inc({ result: 'ack' });
        logger.info('MQ 메시지 소비 완료', {
          tag: 'MQ_CONSUME_DONE',
          result: 'ACK',
          traceId: event.submissionId,
          deliveryTag: msg.fields.deliveryTag,
          durationMs: Date.now() - startTime,
        });
      } catch (error: unknown) {
        logger.error('처리 실패 — DLQ 전송', {
          tag: 'MQ_CONSUME_DONE',
          result: 'NACK_DLQ',
          traceId: event.submissionId,
          deliveryTag: msg.fields.deliveryTag,
          durationMs: Date.now() - startTime,
          err: error as Error,
        });

        // H-6: NACK 전 Submission에 실패 보고 (best-effort)
        try {
          await this.statusReporter.reportFailed(event.submissionId);
        } catch (reportErr) {
          logger.warn('실패 보고도 실패', {
            tag: 'REPORT_FAILED_ERR',
            traceId: event.submissionId,
            err: reportErr as Error,
          });
        }

        // DLQ로 전송 (nack + requeue=false)
        channel.nack(msg, false, false);
        dlqMessagesTotal.inc({ reason: 'process_failure' });
        mqMessagesProcessedTotal.inc({ result: 'nack_dlq' });
      }
    });
  }

  /**
   * Gateway Internal API로 유저 GitHub 토큰 정보 조회
   * 보안: X-Internal-Key 필수, 토큰 로그 출력 금지
   */
  private async getUserGitHubInfo(userId: string): Promise<UserGitHubInfo> {
    const res = await fetch(
      `${this.gatewayInternalUrl}/internal/users/${userId}/github-token`,
      {
        headers: {
          'X-Internal-Key': this.internalKeyGateway,
          'Content-Type': 'application/json',
        },
      },
    );

    if (!res.ok) {
      throw new Error(`유저 GitHub 정보 조회 실패: ${res.status}`);
    }

    return (await res.json()) as UserGitHubInfo;
  }

  /**
   * Problem Service에서 문제 정보 조회 (제목, 주차)
   */
  private async getProblemInfo(
    problemId: string,
    studyId: string,
    userId: string,
  ): Promise<{ title: string; weekNumber: string; sourcePlatform: string; sourceUrl: string }> {
    try {
      const res = await fetch(
        `${this.problemServiceUrl}/internal/${problemId}`,
        {
          headers: {
            'x-internal-key': this.problemServiceKey,
            'x-study-id': studyId,
            'x-user-id': userId,
            'Content-Type': 'application/json',
          },
        },
      );

      if (!res.ok) {
        logger.warn(`Problem 정보 조회 실패 (${res.status}) — 기본값 사용`, {
          tag: 'PROBLEM_FETCH',
        });
        return { title: problemId, weekNumber: '', sourcePlatform: '', sourceUrl: '' };
      }

      const body = (await res.json()) as {
        data: { title: string; weekNumber: string; sourcePlatform: string; sourceUrl: string };
      };
      return {
        title: body.data.title ?? problemId,
        weekNumber: body.data.weekNumber ?? '',
        sourcePlatform: body.data.sourcePlatform ?? '',
        sourceUrl: body.data.sourceUrl ?? '',
      };
    } catch {
      logger.warn('Problem 정보 조회 예외 — 기본값 사용', {
        tag: 'PROBLEM_FETCH',
      });
      return { title: problemId, weekNumber: '', sourcePlatform: '', sourceUrl: '' };
    }
  }

  private async processWithRetry(event: GitHubPushEvent): Promise<void> {
    // 제출 데이터 조회 (userId 획득)
    const submission = await this.statusReporter.getSubmission(event.submissionId);

    // 문제 정보 조회 (제목, 주차)
    const problemInfo = await this.getProblemInfo(submission.problemId, event.studyId, submission.userId);

    // 유저 GitHub 정보 조회
    const githubInfo = await this.getUserGitHubInfo(submission.userId);

    // GitHub 미연동 → SKIPPED 처리 후 ACK
    if (!githubInfo.github_username) {
      logger.info('SKIPPED: GitHub 미연동', { tag: 'GITHUB_SKIP', traceId: event.submissionId });
      await this.statusReporter.reportSkipped(event.submissionId);
      mqMessagesProcessedTotal.inc({ result: 'skipped' });
      return;
    }

    // 토큰 복호화 시도 → 실패 시 GitHub App 설치 토큰 fallback
    let decryptedToken: string;
    if (githubInfo.github_token) {
      try {
        decryptedToken = this.tokenManager.decryptUserToken(githubInfo.github_token);
      } catch {
        logger.warn('유저 토큰 복호화 실패 → App 토큰 fallback', { tag: 'GITHUB_APP_FALLBACK', traceId: event.submissionId, code: 'GHW_BIZ_005' });
        try {
          decryptedToken = await this.tokenManager.getTokenForRepo(githubInfo.github_username, 'algosu-submissions');
        } catch (appTokenErr) {
          logger.warn('App 토큰 fallback도 실패', { tag: 'GITHUB_SKIP', traceId: event.submissionId, err: appTokenErr as Error });
          await this.statusReporter.reportTokenInvalid(event.submissionId);
          await this.statusReporter.publishStatusChange(event.submissionId, 'github_token_invalid');
          mqMessagesProcessedTotal.inc({ result: 'skipped' });
          return;
        }
      }
    } else {
      // 토큰 없음 → GitHub App 설치 토큰으로 push 시도
      try {
        decryptedToken = await this.tokenManager.getTokenForRepo(githubInfo.github_username, 'algosu-submissions');
        logger.info('유저 토큰 없음 → App 토큰 사용', { tag: 'GITHUB_APP_FALLBACK', traceId: event.submissionId });
      } catch {
        logger.info('SKIPPED: 유저 토큰 없음 + App 토큰 불가', { tag: 'GITHUB_SKIP', traceId: event.submissionId });
        await this.statusReporter.reportSkipped(event.submissionId);
        mqMessagesProcessedTotal.inc({ result: 'skipped' });
        return;
      }
    }

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        // GitHub Push 실행 (유저 토큰 기반)
        const result = await this.pushService.push({
          submissionId: event.submissionId,
          userId: submission.userId,
          problemId: submission.problemId,
          language: submission.language,
          code: submission.code,
          githubUsername: githubInfo.github_username,
          githubToken: decryptedToken,
          problemTitle: problemInfo.title,
          weekNumber: problemInfo.weekNumber,
          sourcePlatform: problemInfo.sourcePlatform,
          sourceUrl: problemInfo.sourceUrl,
        });

        // 성공: Saga 상태 업데이트 (GITHUB_QUEUED → AI_QUEUED)
        await this.statusReporter.reportSuccess(event.submissionId, result.filePath);

        // Redis Pub/Sub으로 상태 브로드캐스트
        await this.statusReporter.publishStatusChange(event.submissionId, 'github_synced');

        return;
      } catch (error: unknown) {
        lastError = error as Error;
        const isTokenInvalid =
          lastError.message.includes('TOKEN_INVALID') ||
          lastError.message.includes('401') ||
          lastError.message.includes('403');

        if (isTokenInvalid) {
          // TOKEN_INVALID — 재시도 의미 없음
          logger.warn('TOKEN_INVALID', { code: 'GHW_BIZ_001' });
          await this.statusReporter.reportTokenInvalid(event.submissionId);
          await this.statusReporter.publishStatusChange(
            event.submissionId,
            'github_token_invalid',
          );
          return;
        }

        if (attempt < MAX_RETRIES) {
          // Rate Limit 429 → Retry-After 기반 대기
          const delayMs =
            lastError instanceof GitHubRateLimitError
              ? lastError.retryAfterMs
              : RETRY_DELAY_MS * attempt;
          logger.warn('재시도', { retryCount: attempt, err: lastError });
          await this.delay(delayMs);
        }
      }
    }

    // 모든 재시도 실패 → Saga 콜백으로 AI 분석 진행 (GitHub 실패해도 AI 분석은 독립)
    logger.error('GitHub Push 최종 실패 — Saga 보상 트랜잭션 실행', {
      tag: 'GITHUB_PUSH_FAILED',
      traceId: event.submissionId,
      err: lastError,
    });
    await this.statusReporter.reportFailed(event.submissionId);
    await this.statusReporter.publishStatusChange(event.submissionId, 'github_failed');
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async stop(): Promise<void> {
    this.isShuttingDown = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.channel) await this.channel.close();
    if (this.connection) await this.connection.close();
    await this.tokenManager.close();
    await this.statusReporter.close();
    await this.redis.quit();
    logger.info('종료 완료');
  }
}
