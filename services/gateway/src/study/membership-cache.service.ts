/**
 * @file 스터디 멤버십 Redis 캐시 — 단독 소유 + 무효화
 * @domain study
 * @layer service
 * @related StudyService, StudyMemberService, StudyMemberGuard
 *
 * 멤버십 권한 캐시(membership:{studyId}:{userId})의 Redis 클라이언트를 단독 소유한다.
 * 캐시 무효화는 권한 변동 시점(가입/탈퇴/역할변경/추방/삭제)에 호출된다.
 */
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

@Injectable()
export class MembershipCacheService implements OnModuleDestroy {
  private readonly redis: Redis;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: StructuredLoggerService,
  ) {
    this.logger.setContext(MembershipCacheService.name);
    const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.redis = new Redis(redisUrl);
    this.redis.on('error', (err: Error) => {
      // M11: Redis 연결 에러 핸들링 — 프로세스 크래시 방지
      this.logger.error(`Redis 연결 오류: ${err.message}`);
    });
  }

  /**
   * Redis 연결 정상 종료 (모듈 해제 시)
   * @domain study
   */
  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }

  /**
   * 단일 사용자 멤버십 캐시 무효화 — 통일 키 규격
   * @domain study
   * @param studyId - 스터디 ID
   * @param userId - 사용자 ID
   */
  async invalidate(studyId: string, userId: string): Promise<void> {
    await Promise.all([
      this.redis.del(`membership:${studyId}:${userId}`),
      this.redis.del(`membership:${studyId}:${userId}:denied`),
    ]);
  }

  /**
   * 스터디 전체 멤버십 캐시 무효화 — 패턴 삭제 (스터디 삭제 시)
   * @domain study
   * @param studyId - 스터디 ID
   */
  async invalidateAll(studyId: string): Promise<void> {
    const keys = await this.redis.keys(`membership:${studyId}:*`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
