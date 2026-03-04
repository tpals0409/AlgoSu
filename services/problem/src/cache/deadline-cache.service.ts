/**
 * @file 마감 시간 Redis 캐시 서비스 — TTL 기반 캐시 + 무효화
 * @domain problem
 * @layer service
 * @related problem.service.ts, cache.module.ts
 */
import { Injectable, Inject, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './cache.module';

/**
 * 마감 시간 Redis 캐싱 서비스
 *
 * 설계:
 * - 캐시 키: `deadline:{studyId}:{problemId}` — 스터디별 마감 캐시 분리
 * - 캐시 값: ISO 8601 날짜 문자열 또는 'null' (마감 없음)
 * - TTL: 300초 (5분) — 마감 시간 변경은 빈번하지 않음
 * - Submission Service가 내부 HTTP로 조회 시 캐시 우선 반환
 *
 * 보안: Redis TTL 필수 설정, studyId 스코핑으로 cross-study 접근 방지
 */
@Injectable()
export class DeadlineCacheService {
  private readonly logger = new Logger(DeadlineCacheService.name);
  private readonly TTL_SECONDS = 300; // 5분
  private readonly KEY_PREFIX = 'deadline:';

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  /**
   * 마감 시간 캐시 조회
   * 키: `deadline:{studyId}:{problemId}`
   * @returns ISO 날짜 문자열, 'null' (마감 없음), 또는 null (캐시 미스)
   */
  async getDeadline(studyId: string, problemId: string): Promise<string | null> {
    try {
      const cached = await this.redis.get(`${this.KEY_PREFIX}${studyId}:${problemId}`);
      if (cached !== null) {
        this.logger.debug(`캐시 히트: studyId=${studyId}, problemId=${problemId}`);
      }
      return cached;
    } catch (error: unknown) {
      this.logger.warn(`캐시 조회 실패 (fall-through): ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * 마감 시간 캐시 설정
   * 키: `deadline:{studyId}:{problemId}`
   */
  async setDeadline(studyId: string, problemId: string, deadline: Date | null): Promise<void> {
    try {
      const value = deadline ? deadline.toISOString() : 'null';
      await this.redis.set(`${this.KEY_PREFIX}${studyId}:${problemId}`, value, 'EX', this.TTL_SECONDS);
    } catch (error: unknown) {
      this.logger.warn(`캐시 설정 실패: ${(error as Error).message}`);
    }
  }

  /**
   * 마감 시간 캐시 무효화 (문제 수정/삭제 시)
   */
  async invalidateDeadline(studyId: string, problemId: string): Promise<void> {
    try {
      await this.redis.del(`${this.KEY_PREFIX}${studyId}:${problemId}`);
    } catch (error: unknown) {
      this.logger.warn(`캐시 무효화 실패: ${(error as Error).message}`);
    }
  }

  /**
   * 주차별 문제 목록 캐시
   * 키: `problem:week:{studyId}:{weekNumber}`
   * TTL: 600초 (10분)
   */
  async getWeekProblems(studyId: string, weekNumber: string): Promise<string | null> {
    try {
      return await this.redis.get(`problem:week:${studyId}:${weekNumber}`);
    } catch {
      return null;
    }
  }

  async setWeekProblems(studyId: string, weekNumber: string, data: string): Promise<void> {
    try {
      await this.redis.set(`problem:week:${studyId}:${weekNumber}`, data, 'EX', 600);
    } catch (error: unknown) {
      this.logger.warn(`주차별 캐시 설정 실패: ${(error as Error).message}`);
    }
  }

  async invalidateWeekProblems(studyId: string, weekNumber: string): Promise<void> {
    try {
      await this.redis.del(`problem:week:${studyId}:${weekNumber}`);
    } catch (error: unknown) {
      this.logger.warn(`주차별 캐시 무효화 실패: ${(error as Error).message}`);
    }
  }
}
