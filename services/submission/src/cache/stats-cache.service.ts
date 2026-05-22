/**
 * @file stats-cache.service.ts — 대시보드 통계 Redis 캐시 서비스
 * @domain submission
 * @layer service
 * @related cache.module.ts, submission.service.ts
 */
import { Injectable, Inject } from '@nestjs/common';
import { createHash } from 'crypto';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './cache.constants';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

/** SCAN 배치 크기 — 프로덕션 블로킹 최소화 */
const SCAN_COUNT = 100;

/**
 * 대시보드 통계 Redis 캐싱 서비스
 *
 * 설계:
 * - 캐시 키: `stats:{studyId}:w={weekNumber|'-'}:u={userId|'-'}`
 * - TTL: 300초 (5분) — 안전망
 * - 무효화: SCAN 기반 패턴 삭제 (KEYS 금지 — 프로덕션 블로킹 회피)
 * - Fail-Open: Redis 장애 시 에러 전파 없이 캐시 미스/무시 처리
 */
@Injectable()
export class StatsCacheService {
  private readonly TTL_SECONDS = 300;
  private readonly KEY_PREFIX = 'stats:';

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly logger: StructuredLoggerService,
  ) {
    this.logger.setContext(StatsCacheService.name);
  }

  /**
   * 통계 캐시 조회 (Fail-Open: 에러 → null)
   * @returns 캐시 히트 시 파싱된 데이터, 미스/에러 시 null
   */
  async get(studyId: string, weekNumber?: string, userId?: string, activeProblemIds?: string[]): Promise<unknown | null> {
    try {
      const key = this.buildKey(studyId, weekNumber, userId, activeProblemIds);
      const cached = await this.redis.get(key);
      if (cached === null) return null;
      this.logger.debug(`캐시 히트: ${key}`);
      return JSON.parse(cached);
    } catch (error: unknown) {
      this.logger.warn(`캐시 조회 실패 (fall-through): ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * 통계 캐시 설정 (Fail-Open: 에러 → 무시)
   */
  async set(studyId: string, data: unknown, weekNumber?: string, userId?: string, activeProblemIds?: string[]): Promise<void> {
    try {
      const key = this.buildKey(studyId, weekNumber, userId, activeProblemIds);
      await this.redis.set(key, JSON.stringify(data), 'EX', this.TTL_SECONDS);
    } catch (error: unknown) {
      this.logger.warn(`캐시 설정 실패: ${(error as Error).message}`);
    }
  }

  /**
   * 스터디 통계 캐시 무효화 — SCAN 기반 패턴 삭제
   * `stats:{studyId}:*` 패턴의 모든 키를 배치 삭제 (Fail-Open)
   */
  async invalidate(studyId: string): Promise<void> {
    try {
      const pattern = `${this.KEY_PREFIX}${studyId}:*`;
      await this.scanAndDelete(pattern);
    } catch (error: unknown) {
      this.logger.warn(`캐시 무효화 실패: ${(error as Error).message}`);
    }
  }

  /**
   * SCAN 기반 패턴 키 배치 삭제
   */
  private async scanAndDelete(pattern: string): Promise<void> {
    let cursor = '0';
    do {
      const [nextCursor, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        SCAN_COUNT,
      );
      cursor = nextCursor;
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } while (cursor !== '0');
  }

  /**
   * 캐시 키 빌더
   * 형식: `stats:{studyId}:w={weekNumber|'-'}:u={userId|'-'}:p={fingerprint|'-'}`
   * activeProblemIds → 정렬 후 SHA-256 8자 fingerprint (키 안정성 보장)
   */
  private buildKey(studyId: string, weekNumber?: string, userId?: string, activeProblemIds?: string[]): string {
    const w = weekNumber ?? '-';
    const u = userId ?? '-';
    const p = this.buildProblemFingerprint(activeProblemIds);
    return `${this.KEY_PREFIX}${studyId}:w=${w}:u=${u}:p=${p}`;
  }

  /**
   * activeProblemIds fingerprint 생성 — 정렬 후 SHA-256 앞 8자
   */
  private buildProblemFingerprint(activeProblemIds?: string[]): string {
    if (!activeProblemIds || activeProblemIds.length === 0) return '-';
    const sorted = [...activeProblemIds].sort().join(',');
    return createHash('sha256').update(sorted).digest('hex').slice(0, 8);
  }
}
