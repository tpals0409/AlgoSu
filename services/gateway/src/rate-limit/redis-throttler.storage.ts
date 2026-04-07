/**
 * @file Redis 기반 Rate Limit 저장소 — fail-open 정책
 * @domain common
 * @layer service
 * @related rate-limit.middleware.ts
 */
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

/** 인메모리 fallback 엔트리 */
interface MemoryEntry {
  /** 슬라이딩 윈도우 내 요청 타임스탬프 목록 */
  hits: number[];
  /** TTL (밀리초) */
  ttl: number;
}

/** 인메모리 캐시 만료 키 정리 주기 (밀리초) */
const MEMORY_CLEANUP_INTERVAL_MS = 60_000;

/**
 * Redis 기반 Rate Limit 저장소 — 인메모리 fallback 포함
 *
 * 보안 요구사항:
 * - Redis TTL 필수 (메모리 누수 방지)
 * - 로그에 Redis 비밀번호 노출 금지
 * - 연결 실패 시 인메모리 fallback 사용 (가용성 우선)
 * - Redis 복구 시 자동으로 Redis로 복귀
 * - 인메모리 Map은 주기적으로 만료 키 정리 (메모리 누수 방지)
 */
@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage, OnModuleDestroy {
  private readonly redis: Redis;

  /** 인메모리 fallback 저장소 */
  private readonly memoryStore = new Map<string, MemoryEntry>();

  /** 만료 키 정리 타이머 */
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: StructuredLoggerService,
  ) {
    this.logger.setContext(RedisThrottlerStorage.name);
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

    this.startCleanupTimer();
  }

  /**
   * Rate Limit 카운터 증가 (Redis 우선, 장애 시 인메모리 fallback)
   * @param key - 쓰로틀 키
   * @param ttl - 윈도우 크기 (밀리초)
   */
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
      // Redis 장애 시 인메모리 fallback
      this.logger.warn(
        `Rate Limit Redis 오류 — 인메모리 fallback 적용: ${(error as Error).message}`,
      );
      return this.incrementMemory(redisKey, ttl);
    }
  }

  /**
   * 인메모리 슬라이딩 윈도우 카운터 증가
   * @param key - 쓰로틀 키
   * @param ttl - 윈도우 크기 (밀리초)
   */
  private incrementMemory(
    key: string,
    ttl: number,
  ): { totalHits: number; timeToExpire: number } {
    const now = Date.now();
    const windowStart = now - ttl;

    let entry = this.memoryStore.get(key);
    if (!entry) {
      entry = { hits: [], ttl };
      this.memoryStore.set(key, entry);
    }

    // 만료된 항목 제거
    entry.hits = entry.hits.filter((ts) => ts > windowStart);
    // 현재 요청 추가
    entry.hits.push(now);
    entry.ttl = ttl;

    return {
      totalHits: entry.hits.length,
      timeToExpire: ttl,
    };
  }

  /**
   * 만료된 인메모리 키를 주기적으로 정리 (메모리 누수 방지)
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.memoryStore) {
        entry.hits = entry.hits.filter((ts) => ts > now - entry.ttl);
        if (entry.hits.length === 0) {
          this.memoryStore.delete(key);
        }
      }
    }, MEMORY_CLEANUP_INTERVAL_MS);

    // unref로 프로세스 종료 방해 방지
    if (this.cleanupTimer && typeof this.cleanupTimer === 'object' && 'unref' in this.cleanupTimer) {
      this.cleanupTimer.unref();
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.memoryStore.clear();
    await this.redis.quit();
    this.logger.log('Redis throttler 연결 종료');
  }
}
