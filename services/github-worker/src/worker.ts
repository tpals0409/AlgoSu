import * as amqplib from 'amqplib';
import { GitHubPushService } from './github-push.service';
import { TokenManager } from './token-manager';
import { StatusReporter } from './status-reporter';
import { logger } from './logger';
import { config } from './config';

/**
 * GitHub Worker — RabbitMQ 소비자
 *
 * 보안 요구사항:
 * - GitHub App Token은 Redis에서만 참조 (로그 노출 금지)
 * - 메시지에 토큰/키 포함 금지
 * - Gateway Internal API 호출 시 X-Internal-Key 필수
 * - 스터디 레포 정보 로그 출력 금지
 * - prefetch=2: 동시 처리량 제한 (Free Tier 리소스 보호)
 */

interface GitHubPushEvent {
  submissionId: string;
  studyId: string;
  timestamp: string;
}

interface StudyInfo {
  github_repo: string | null;
}

const QUEUE = 'submission.github_push';
const MAX_RETRIES = config.maxRetries;
const RETRY_DELAY_MS = config.retryDelayMs;

export class GitHubWorker {
  private connection: amqplib.ChannelModel | null = null;
  private channel: amqplib.Channel | null = null;
  private pushService: GitHubPushService;
  private tokenManager: TokenManager;
  private statusReporter: StatusReporter;

  private readonly gatewayInternalUrl: string;
  private readonly internalKeyGateway: string;

  constructor() {
    this.tokenManager = new TokenManager();
    this.pushService = new GitHubPushService(this.tokenManager);
    this.statusReporter = new StatusReporter();
    this.gatewayInternalUrl = config.gatewayInternalUrl;
    this.internalKeyGateway = config.internalKeyGateway;
  }

  async start(): Promise<void> {
    this.connection = await amqplib.connect(config.rabbitmqUrl);

    // C5: MQ 연결 오류/종료 핸들러 — unhandledRejection 방지
    this.connection.on('error', (err: Error) => {
      logger.error('RabbitMQ 연결 오류', { tag: 'MQ_CONNECTION_ERROR', err });
    });
    this.connection.on('close', () => {
      logger.warn('RabbitMQ 연결 종료 — 프로세스 종료 (k8s 재시작 의존)', { tag: 'MQ_CONNECTION_CLOSED' });
      process.exit(1);
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
      }
    });
  }

  /**
   * Gateway Internal API로 스터디 github_repo 조회
   * 보안: X-Internal-Key 필수, 레포 정보 로그 출력 금지
   */
  private async getStudyGithubRepo(studyId: string): Promise<string | null> {
    const res = await fetch(
      `${this.gatewayInternalUrl}/internal/studies/${studyId}`,
      {
        headers: {
          'X-Internal-Key': this.internalKeyGateway,
          'Content-Type': 'application/json',
        },
      },
    );

    if (!res.ok) {
      throw new Error(`스터디 조회 실패: ${res.status}`);
    }

    const body = (await res.json()) as { data: StudyInfo };
    return body.data.github_repo ?? null;
  }

  private async processWithRetry(event: GitHubPushEvent): Promise<void> {
    // studyId 필수 검증
    if (!event.studyId) {
      logger.error('studyId 누락 — DLQ', {
        traceId: event.submissionId,
        code: 'GHW_BIZ_003',
        tag: 'MQ_CONSUME_DONE',
        result: 'NACK_DLQ',
      });
      throw new Error(`studyId 누락: submissionId=${event.submissionId}`);
    }

    // 스터디 GitHub 레포 조회
    const githubRepo = await this.getStudyGithubRepo(event.studyId);

    // github_repo 미연결 → SKIPPED 처리 후 ACK
    if (!githubRepo) {
      logger.info('SKIPPED: github_repo 없음', { tag: 'GITHUB_SKIP', traceId: event.submissionId });
      await this.statusReporter.reportSkipped(event.submissionId);
      return;
    }

    // github_repo 파싱: "owner/repo" 형식
    const slashIdx = githubRepo.indexOf('/');
    if (slashIdx === -1) {
      logger.error('github_repo 형식 오류 — DLQ', {
        traceId: event.submissionId,
        code: 'GHW_BIZ_004',
        tag: 'MQ_CONSUME_DONE',
        result: 'NACK_DLQ',
      });
      throw new Error(`github_repo 형식 오류: submissionId=${event.submissionId}`);
    }
    const repoOwner = githubRepo.slice(0, slashIdx);
    const repoName = githubRepo.slice(slashIdx + 1);

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        // 제출 데이터 조회
        const submission = await this.statusReporter.getSubmission(event.submissionId);

        // GitHub Push 실행 (레포 정보 동적 전달)
        const result = await this.pushService.push({
          submissionId: event.submissionId,
          userId: submission.userId,
          problemId: submission.problemId,
          language: submission.language,
          code: submission.code,
          repoOwner,
          repoName,
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
    if (this.channel) await this.channel.close();
    if (this.connection) await this.connection.close();
    await this.tokenManager.close();
    await this.statusReporter.close();
    logger.info('종료 완료');
  }
}
