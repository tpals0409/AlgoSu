/**
 * @file 초대코드 brute force 방어 서비스
 * @domain study
 * @layer service
 * @guard invite-code-lock
 * @related StudyService.joinByInviteCode
 */
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

// ─── CONSTANTS ────────────────────────────
const MAX_FAILURES = 5;
const LOCK_SECONDS = 900; // 15분

@Injectable()
export class InviteThrottleService {
  private readonly logger = new Logger(InviteThrottleService.name);
  private readonly redis: Redis;

  constructor(private readonly configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.redis = new Redis(redisUrl);
    this.redis.on('error', (err: Error) => {
      this.logger.error(`Redis 연결 오류: ${err.message}`);
    });
  }

  /**
   * 초대코드 실패 시 카운터 증가 + 잠금 체크
   * @domain study
   * @guard invite-code-lock
   * @param ip - 요청자 IP
   * @param code - 시도한 초대코드
   * @throws BadRequestException 5회 초과 시
   */
  async recordFailure(ip: string, code: string): Promise<void> {
    const key = `invite_fail:${ip}:${code}`;
    const count = await this.redis.incr(key);

    if (count === 1) {
      await this.redis.expire(key, LOCK_SECONDS);
    }

    if (count >= MAX_FAILURES) {
      this.logger.warn(`초대코드 brute force 감지: ip=${ip}, code=***`);
      throw new BadRequestException('초대코드 입력 횟수를 초과했습니다. 15분 후 다시 시도해주세요.');
    }
  }

  /**
   * 잠금 상태 확인 (입력 전 선제 검사)
   * @domain study
   * @guard invite-code-lock
   * @param ip - 요청자 IP
   * @param code - 시도할 초대코드
   * @throws BadRequestException 잠금 중일 때
   */
  async checkLock(ip: string, code: string): Promise<void> {
    const key = `invite_fail:${ip}:${code}`;
    const count = await this.redis.get(key);

    if (count && Number(count) >= MAX_FAILURES) {
      throw new BadRequestException('초대코드 입력 횟수를 초과했습니다. 15분 후 다시 시도해주세요.');
    }
  }

  /**
   * 성공 시 카운터 초기화
   * @domain study
   * @param ip - 요청자 IP
   * @param code - 성공한 초대코드
   */
  async clearFailures(ip: string, code: string): Promise<void> {
    const key = `invite_fail:${ip}:${code}`;
    await this.redis.del(key);
  }
}
