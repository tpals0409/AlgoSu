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
      const totalHits = await this.redis.incr(redisKey);

      if (totalHits === 1) {
        // 첫 번째 요청: TTL 설정 (초 단위)
        const ttlSeconds = Math.ceil(ttl / 1000);
        await this.redis.expire(redisKey, ttlSeconds);
      }

      const ttlRemaining = await this.redis.ttl(redisKey);

      return {
        totalHits,
        timeToExpire: Math.max(ttlRemaining * 1000, 0),
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
