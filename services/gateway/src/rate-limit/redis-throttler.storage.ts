/**
 * @file Redis 기반 Rate Limit 저장소 — fail-open 정책
 * @domain common
 * @layer service
 * @related rate-limit.middleware.ts
 */
import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Redis 기반 Rate Limit 저장소
 *
 * 보안 요구사항:
 * - Redis TTL 필수 (메모리 누수 방지)
 * - 로그에 Redis 비밀번호 노출 금지
 * - 연결 실패 시 요청 차단이 아닌 허용 (fail-open) — 가용성 우선
 */
@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage, OnModuleDestroy {
  private readonly logger = new Logger(RedisThrottlerStorage.name);
  private readonly redis: Redis;

  constructor(private readonly configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times: number): number | null {
        if (times > 3) return null;
        return Math.min(times * 200, 1000);
      },
    });

    this.redis.on('error', (err: Error) => {
      // 로그에 Redis 비밀번호/URL 원문 노출 금지
      this.logger.error(`Redis 연결 오류: ${err.message}`);
    });
  }

  async increment(key: string, ttl: number): Promise<{ totalHits: number; timeToExpire: number }> {
    const redisKey = `throttle:${key}`;

    try {
      const now = Date.now();
      const windowStart = now - ttl;

      // Sliding window: sorted set에 현재 timestamp 추가 + 만료된 항목 제거 + 카운트
      const pipeline = this.redis.pipeline();
      pipeline.zremrangebyscore(redisKey, 0, windowStart);
      pipeline.zadd(redisKey, now, `${now}:${Math.random()}`);
      pipeline.zcard(redisKey);
      pipeline.pexpire(redisKey, ttl);

      const results = await pipeline.exec();

      // results[2] = ZCARD 결과
      const totalHits = (results?.[2]?.[1] as number) ?? 0;

      return {
        totalHits,
        timeToExpire: ttl,
      };
    } catch (error: unknown) {
      // Redis 장애 시 fail-open (가용성 우선)
      this.logger.warn(`Rate Limit Redis 오류 — fail-open 적용: ${(error as Error).message}`);
      return {
        totalHits: 0,
        timeToExpire: ttl,
      };
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
    this.logger.log('Redis throttler 연결 종료');
  }
}
