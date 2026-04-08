/**
 * @file 이벤트 로깅 서비스 — Redis 버퍼 + 5분 Cron NDJSON flush
 * @domain event-log
 * @layer service
 * @related EventLogController
 */
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import Redis from 'ioredis';
import * as fs from 'fs';
import * as path from 'path';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

export interface EventPayload {
  type: string;
  page?: string;
  target?: string;
  value?: number;
  sessionId: string;
  userId?: string;
  ts: string;
  meta?: Record<string, unknown>;
}

const REDIS_KEY = 'events:log';
const REDIS_TEMP_KEY = 'events:log:flushing';
const LOG_DIR = '/var/log/algosu/events';

@Injectable()
export class EventLogService implements OnModuleDestroy {
  private readonly redis: Redis;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: StructuredLoggerService,
  ) {
    this.logger.setContext(EventLogService.name);
    const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times: number): number | null {
        if (times > 3) return null;
        return Math.min(times * 200, 1000);
      },
    });
    this.redis.on('error', (err: Error) => {
      this.logger.error(`이벤트 로그 Redis 오류: ${err.message}`);
    });
  }

  /**
   * 이벤트를 Redis LIST에 버퍼링
   * @param events - 이벤트 페이로드 배열
   */
  async bufferEvents(events: EventPayload[]): Promise<void> {
    try {
      const serialized = events.map((e) => JSON.stringify(e));
      await this.redis.rpush(REDIS_KEY, ...serialized);
    } catch (err: unknown) {
      this.logger.error(`이벤트 Redis RPUSH 실패 (${events.length}건 유실): ${(err as Error).message}`);
    }
  }

  /**
   * 5분마다 Redis에서 이벤트를 꺼내 NDJSON 파일로 flush
   * RENAME 패턴으로 atomic하게 처리하여 race condition 방지
   */
  @Cron('0 */5 * * * *')
  async flushToFile(): Promise<void> {
    try {
      // RENAME으로 atomic하게 키 이동 (다른 RPUSH와 충돌 방지)
      const renamed = await this.redis.rename(REDIS_KEY, REDIS_TEMP_KEY).catch(() => null);
      if (!renamed) {
        // 키가 없으면 flush할 이벤트 없음
        return;
      }

      const items = await this.redis.lrange(REDIS_TEMP_KEY, 0, -1);
      await this.redis.del(REDIS_TEMP_KEY);

      if (items.length === 0) {
        return;
      }

      const ndjson = items.map((item) => item).join('\n') + '\n';
      const dateStr = new Date().toISOString().slice(0, 10);
      const filePath = path.join(LOG_DIR, `${dateStr}.ndjson`);

      try {
        fs.mkdirSync(LOG_DIR, { recursive: true });
        fs.appendFileSync(filePath, ndjson, 'utf-8');
        this.logger.log(`이벤트 flush 완료: ${items.length}건 → ${filePath}`);
      } catch (fileErr: unknown) {
        this.logger.error(`이벤트 파일 쓰기 실패: ${(fileErr as Error).message}`);
      }
    } catch (err: unknown) {
      this.logger.error(`이벤트 flush 실패: ${(err as Error).message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
    this.logger.log('이벤트 로그 Redis 연결 종료');
  }
}
