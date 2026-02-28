import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqplib from 'amqplib';

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
}

@Injectable()
export class MqPublisherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqPublisherService.name);
  private connection: amqplib.ChannelModel | null = null;
  private channel: amqplib.Channel | null = null;

  private readonly EXCHANGE = 'submission.events';
  private readonly GITHUB_QUEUE = 'submission.github_push';
  private readonly AI_QUEUE = 'submission.ai_analysis';
  private readonly GITHUB_ROUTING_KEY = 'github.push';
  private readonly AI_ROUTING_KEY = 'ai.analysis';

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    try {
      const url = this.configService.getOrThrow<string>('RABBITMQ_URL');
      const conn = await amqplib.connect(url);
      this.connection = conn;
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
      // 연결 실패 시 서비스는 기동하되, 메시지 발행 시 에러 throw
    }
  }

  async publishGitHubPush(event: SubmissionEvent): Promise<void> {
    await this.publish(this.GITHUB_ROUTING_KEY, event);
  }

  async publishAiAnalysis(event: SubmissionEvent): Promise<void> {
    await this.publish(this.AI_ROUTING_KEY, event);
  }

  private async publish(routingKey: string, event: SubmissionEvent): Promise<void> {
    if (!this.channel) {
      throw new Error('RabbitMQ 채널이 초기화되지 않았습니다.');
    }

    const message = Buffer.from(JSON.stringify(event));
    this.channel.publish(this.EXCHANGE, routingKey, message, {
      persistent: true,
      contentType: 'application/json',
      timestamp: Date.now(),
    });

    this.logger.log(`MQ 발행: routingKey=${routingKey}, submissionId=${event.submissionId}`);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.channel) await this.channel.close();
    if (this.connection) await this.connection.close();
    this.logger.log('RabbitMQ 연결 종료');
  }
}
