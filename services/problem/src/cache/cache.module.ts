import { Module, Global, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

export const REDIS_CLIENT = 'REDIS_CLIENT';

/**
 * Redis 캐시 모듈 — 마감 시간 캐싱, Problem 데이터 캐싱
 *
 * 보안 요구사항:
 * - Redis TTL 필수 (메모리 누수 방지)
 * - 로그에 Redis 비밀번호 노출 금지
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): Redis => {
        const logger = new StructuredLoggerService();
        logger.setContext('CacheModule');
        const redisUrl = configService.get<string>('REDIS_URL', 'redis://localhost:6379');
        const redis = new Redis(redisUrl, {
          maxRetriesPerRequest: 3,
          retryStrategy(times: number): number | null {
            if (times > 3) return null;
            return Math.min(times * 200, 1000);
          },
        });

        redis.on('error', (err: Error) => {
          logger.error(`Redis 연결 오류: ${err.message}`);
        });

        redis.on('connect', () => {
          logger.log('Redis 연결 성공');
        });

        return redis;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class CacheModule implements OnModuleDestroy {
  async onModuleDestroy(): Promise<void> {
    // Redis 연결 정리는 provider에서 자체 관리
  }
}
