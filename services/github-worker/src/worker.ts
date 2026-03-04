/**
 * @file GitHub Worker — RabbitMQ 소비자 + 유저 토큰 기반 Push
 * @domain github
 * @layer service
 * @related github-push.service.ts, token-manager.ts, status-reporter.ts
 */
import * as amqplib from 'amqplib';
import { GitHubPushService } from './github-push.service';
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

export class GitHubWorker {
  private connection: amqplib.ChannelModel | null = null;
  private channel: amqplib.Channel | null = null;
  private pushService: GitHubPushService;
  private tokenManager: TokenManager;
  private statusReporter: StatusReporter;

  private readonly gatewayInternalUrl: string;
  private readonly internalKeyGateway: string;

  // M14: 재연결 상태 추적
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isShuttingDown = false;

  constructor() {
    this.tokenManager = new TokenManager();
    this.pushService = new GitHubPushService(this.tokenManager);
    this.statusReporter = new StatusReporter();
    this.gatewayInternalUrl = config.gatewayInternalUrl;
    this.internalKeyGateway = config.internalKeyGateway;
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
        logger.info('MQ 메시지 소비 시작', {
          tag: 'MQ_CONSUME',
          queue: QUEUE,
          traceId: event.submissionId,
          deliveryTag: msg.fields.deliveryTag,
          redelivered: msg.fields.redelivered,
        });

        await this.processWithRetry(event);
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

  private async processWithRetry(event: GitHubPushEvent): Promise<void> {
    // 제출 데이터 조회 (userId 획득)
    const submission = await this.statusReporter.getSubmission(event.submissionId);

    // 유저 GitHub 정보 조회
    const githubInfo = await this.getUserGitHubInfo(submission.userId);

    // GitHub 토큰 없음 → SKIPPED 처리 후 ACK
    if (!githubInfo.github_username || !githubInfo.github_token) {
      logger.info('SKIPPED: GitHub 미연동 또는 토큰 없음', { tag: 'GITHUB_SKIP', traceId: event.submissionId });
      await this.statusReporter.reportSkipped(event.submissionId);
      mqMessagesProcessedTotal.inc({ result: 'skipped' });
      return;
    }

    // 토큰 복호화
    let decryptedToken: string;
    try {
      decryptedToken = this.tokenManager.decryptUserToken(githubInfo.github_token);
    } catch {
      logger.warn('토큰 복호화 실패', { tag: 'GITHUB_SKIP', traceId: event.submissionId, code: 'GHW_BIZ_005' });
      await this.statusReporter.reportTokenInvalid(event.submissionId);
      await this.statusReporter.publishStatusChange(event.submissionId, 'github_token_invalid');
      mqMessagesProcessedTotal.inc({ result: 'skipped' });
      return;
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
          logger.warn('재시도', { retryCount: attempt, err: lastError });
          await this.delay(RETRY_DELAY_MS * attempt);
        }
      }
    }

    // 모든 재시도 실패
    logger.error('최종 실패', { tag: 'MQ_CONSUME_DONE', result: 'NACK_DLQ', err: lastError });
    await this.statusReporter.reportFailed(event.submissionId);
    await this.statusReporter.publishStatusChange(event.submissionId, 'github_failed');

    throw lastError ?? new Error('GitHub Push 최종 실패');
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
    logger.info('종료 완료');
  }
}
