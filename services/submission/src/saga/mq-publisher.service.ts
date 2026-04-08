/**
 * @file RabbitMQ 메시지 발행 서비스 — Exchange/Queue 관리 + 지수 백오프 재연결
 * @domain submission
 * @layer service
 * @related SagaOrchestratorService, submission.github_push, submission.ai_analysis
 */
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqplib from 'amqplib';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

/**
 * RabbitMQ 메시지 발행 서비스
 *
 * Exchange/Queue 구조:
 * - submission.github_push → GitHub Worker가 소비
 * - submission.ai_analysis → AI Analysis Worker가 소비
 *
 * 메시지 포맷:
 * {
 *   submissionId: string,
 *   timestamp: string (ISO 8601)
 * }
 *
 * 보안: 메시지에 토큰/키 포함 금지 (Worker가 자체 키로 인증)
 */

interface SubmissionEvent {
  submissionId: string;
  studyId: string;
  timestamp: string;
  userId?: string;
}

@Injectable()
export class MqPublisherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger: StructuredLoggerService;
  private connection: amqplib.ChannelModel | null = null;
  private channel: amqplib.Channel | null = null;

  private readonly EXCHANGE = 'submission.events';
  private readonly GITHUB_QUEUE = 'submission.github_push';
  private readonly AI_QUEUE = 'submission.ai_analysis';
  private readonly GITHUB_ROUTING_KEY = 'github.push';
  private readonly AI_ROUTING_KEY = 'ai.analysis';

  constructor(private readonly configService: ConfigService) {
    this.logger = new StructuredLoggerService();
    this.logger.setContext(MqPublisherService.name);
  }

  async onModuleInit(): Promise<void> {
    try {
      const url = this.configService.getOrThrow<string>('RABBITMQ_URL');
      const conn = await amqplib.connect(url);
      this.connection = conn;
      // M14: 연결 끊김 시 자동 재연결
      conn.on('close', () => {
        this.logger.warn('RabbitMQ 연결 끊김 — 재연결 시도');
        this.connection = null;
        this.channel = null;
        this.scheduleReconnect();
      });
      conn.on('error', (err: Error) => {
        this.logger.error(`RabbitMQ 연결 오류: ${err.message}`);
      });
      this.channel = await conn.createChannel();

      // Exchange 및 Queue 선언
      await this.channel.assertExchange(this.EXCHANGE, 'topic', { durable: true });
      await this.channel.assertQueue(this.GITHUB_QUEUE, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': `${this.EXCHANGE}.dlx`,
          'x-dead-letter-routing-key': `${this.GITHUB_ROUTING_KEY}.dead`,
        },
      });
      await this.channel.assertQueue(this.AI_QUEUE, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': `${this.EXCHANGE}.dlx`,
          'x-dead-letter-routing-key': `${this.AI_ROUTING_KEY}.dead`,
        },
      });

      // DLX (Dead Letter Exchange) 및 DLQ
      await this.channel.assertExchange(`${this.EXCHANGE}.dlx`, 'topic', { durable: true });
      await this.channel.assertQueue(`${this.GITHUB_QUEUE}.dlq`, { durable: true });
      await this.channel.assertQueue(`${this.AI_QUEUE}.dlq`, { durable: true });

      // 바인딩
      await this.channel.bindQueue(this.GITHUB_QUEUE, this.EXCHANGE, this.GITHUB_ROUTING_KEY);
      await this.channel.bindQueue(this.AI_QUEUE, this.EXCHANGE, this.AI_ROUTING_KEY);
      await this.channel.bindQueue(
        `${this.GITHUB_QUEUE}.dlq`,
        `${this.EXCHANGE}.dlx`,
        `${this.GITHUB_ROUTING_KEY}.dead`,
      );
      await this.channel.bindQueue(
        `${this.AI_QUEUE}.dlq`,
        `${this.EXCHANGE}.dlx`,
        `${this.AI_ROUTING_KEY}.dead`,
      );

      this.logger.log('RabbitMQ 연결 및 Exchange/Queue 설정 완료');
    } catch (error: unknown) {
      this.logger.error(`RabbitMQ 연결 실패: ${(error as Error).message}`);
      // M14: 지수 백오프 기반 자동 재연결
      this.scheduleReconnect();
    }
  }

  // M14: 지수 백오프 재연결 (최대 30초)
  private reconnectAttempt = 0;
  private static readonly MAX_RECONNECT_DELAY_MS = 30_000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    const delay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempt),
      MqPublisherService.MAX_RECONNECT_DELAY_MS,
    );
    this.reconnectAttempt++;
    this.logger.warn(`RabbitMQ 재연결 시도 예정: ${delay}ms 후 (attempt=${this.reconnectAttempt})`);
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.onModuleInit();
        this.reconnectAttempt = 0;
        this.logger.log('RabbitMQ 재연결 성공');
      } catch {
        this.scheduleReconnect();
      }
    }, delay);
  }

  async publishGitHubPush(event: SubmissionEvent): Promise<void> {
    await this.publish(this.GITHUB_ROUTING_KEY, event);
  }

  /** userId 포함 — AI Worker quota 차감에 필요 */
  async publishAiAnalysis(event: SubmissionEvent): Promise<void> {
    await this.publish(this.AI_ROUTING_KEY, event);
  }

  private static readonly PUBLISH_MAX_RETRIES = 3;
  private static readonly PUBLISH_BASE_DELAY_MS = 100;
  private static readonly PUBLISH_MAX_DELAY_MS = 3000;

  /**
   * 메시지 발행 — 최대 3회 재시도 (지수 백오프: 100ms → 200ms → 400ms, cap 3000ms)
   * channel.publish() 반환값 false(buffer full) 도 실패로 처리
   */
  private async publish(routingKey: string, event: SubmissionEvent): Promise<void> {
    if (!this.channel) {
      throw new Error('RabbitMQ 채널이 초기화되지 않았습니다.');
    }

    const message = Buffer.from(JSON.stringify(event));
    const publishOptions = {
      persistent: true,
      contentType: 'application/json',
      timestamp: Date.now(),
      headers: { 'x-trace-id': event.submissionId },
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MqPublisherService.PUBLISH_MAX_RETRIES; attempt++) {
      try {
        const result = this.channel.publish(this.EXCHANGE, routingKey, message, publishOptions);

        if (result === false) {
          lastError = new Error('RabbitMQ 버퍼 초과 (buffer full)');
          this.logger.warn(
            `MQ 발행 실패 (buffer full): routingKey=${routingKey}, submissionId=${event.submissionId}, attempt=${attempt + 1}/${MqPublisherService.PUBLISH_MAX_RETRIES}`,
          );
        } else {
          this.logger.log(
            `MQ 발행: routingKey=${routingKey}, submissionId=${event.submissionId}`,
          );
          return;
        }
      } catch (error: unknown) {
        lastError = error as Error;
        this.logger.warn(
          `MQ 발행 실패: routingKey=${routingKey}, submissionId=${event.submissionId}, attempt=${attempt + 1}/${MqPublisherService.PUBLISH_MAX_RETRIES}, error=${(error as Error).message}`,
        );
      }

      // 마지막 시도가 아닌 경우에만 대기
      if (attempt < MqPublisherService.PUBLISH_MAX_RETRIES - 1) {
        const delayMs = Math.min(
          MqPublisherService.PUBLISH_BASE_DELAY_MS * Math.pow(2, attempt),
          MqPublisherService.PUBLISH_MAX_DELAY_MS,
        );
        await this.delay(delayMs);
      }
    }

    throw new Error(
      `MQ 발행 최종 실패: routingKey=${routingKey}, submissionId=${event.submissionId}, error=${lastError?.message}`,
    );
  }

  /**
   * 지정 시간(ms) 동안 대기하는 헬퍼
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async onModuleDestroy(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.channel) await this.channel.close();
    if (this.connection) await this.connection.close();
    this.logger.log('RabbitMQ 연결 종료');
  }
}
