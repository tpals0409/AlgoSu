/**
 * @file 초대코드 brute force 방어 서비스
 * @domain study
 * @layer service
 * @guard invite-code-lock
 * @related StudyService.joinByInviteCode
 */
import { Injectable, BadRequestException, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

@Injectable()
export class InviteThrottleService implements OnModuleDestroy {
  private readonly redis: Redis;
  private readonly maxFailures: number;
  private readonly lockSeconds: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: StructuredLoggerService,
  ) {
    this.logger.setContext(InviteThrottleService.name);
    this.maxFailures = this.configService.get<number>('INVITE_MAX_FAILURES', 5);
    this.lockSeconds = this.configService.get<number>('INVITE_LOCK_SECONDS', 900);
    const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.redis = new Redis(redisUrl);
    this.redis.on('error', (err: Error) => {
      this.logger.error(`Redis 연결 오류: ${err.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }

  /**
   * 초대코드 실패 시 카운터 증가 + 잠금 체크
   * Redis 장애 시 fail-open (가용성 우선)
   * @domain study
   * @guard invite-code-lock
   * @param ip - 요청자 IP
   * @param code - 시도한 초대코드
   * @throws BadRequestException 5회 초과 시
   */
  async recordFailure(ip: string, code: string): Promise<void> {
    const key = `invite_fail:${ip}:${code}`;

    try {
      const count = await this.redis.incr(key);

      if (count === 1) {
        await this.redis.expire(key, this.lockSeconds);
      }

      if (count >= this.maxFailures) {
        this.logger.warn(`초대코드 brute force 감지: ip=${ip}, code=***`);
        throw new BadRequestException('초대코드 입력 횟수를 초과했습니다. 15분 후 다시 시도해주세요.');
      }
    } catch (error: unknown) {
      if (error instanceof BadRequestException) throw error;
      this.logger.warn(
        `Redis 장애 — recordFailure fail-open 적용: ${(error as Error).message}`,
      );
    }
  }

  /**
   * 잠금 상태 확인 (입력 전 선제 검사)
   * Redis 장애 시 fail-open (잠금 없음으로 처리)
   * @domain study
   * @guard invite-code-lock
   * @param ip - 요청자 IP
   * @param code - 시도할 초대코드
   * @throws BadRequestException 잠금 중일 때
   */
  async checkLock(ip: string, code: string): Promise<void> {
    const key = `invite_fail:${ip}:${code}`;

    try {
      const count = await this.redis.get(key);

      if (count && Number(count) >= this.maxFailures) {
        throw new BadRequestException('초대코드 입력 횟수를 초과했습니다. 15분 후 다시 시도해주세요.');
      }
    } catch (error: unknown) {
      if (error instanceof BadRequestException) throw error;
      this.logger.warn(
        `Redis 장애 — checkLock fail-open 적용: ${(error as Error).message}`,
      );
    }
  }

  /**
   * 성공 시 카운터 초기화
   * Redis 장애 시 fail-open (무시)
   * @domain study
   * @param ip - 요청자 IP
   * @param code - 성공한 초대코드
   */
  async clearFailures(ip: string, code: string): Promise<void> {
    const key = `invite_fail:${ip}:${code}`;

    try {
      await this.redis.del(key);
    } catch (error: unknown) {
      this.logger.warn(
        `Redis 장애 — clearFailures fail-open 적용: ${(error as Error).message}`,
      );
    }
  }
}
